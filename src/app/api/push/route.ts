import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import { readJson } from "@/lib/http/request";
import { pushConfigured, sendPush } from "@/lib/push";
import { consume, tooManyRequests } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Notifications du navigateur : un appareil s'abonne (POST) ou se désabonne
 * (DELETE). Réservé à Premium. L'adresse de livraison doit appartenir à un
 * service de notifications connu : sinon le serveur pourrait être utilisé
 * pour envoyer des requêtes vers n'importe quelle adresse.
 */

const PUSH_HOSTS = [
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "web.push.apple.com",
  "notify.windows.com",
];

const BodySchema = z.object({
  endpoint: z
    .string()
    .url()
    .max(2000)
    .refine((value) => {
      try {
        const url = new URL(value);
        return (
          url.protocol === "https:" &&
          PUSH_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))
        );
      } catch {
        return false;
      }
    }, "service de notifications inconnu"),
  keys: z.object({ p256dh: z.string().min(20).max(200), auth: z.string().min(8).max(100) }),
});

const MAX_DEVICES = 5;

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth) return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  if (auth.profile.plan !== "family") {
    return NextResponse.json({ error: "réservé à Premium", code: "upgrade_required" }, { status: 402 });
  }
  if (!pushConfigured()) {
    return NextResponse.json({ error: "notifications indisponibles" }, { status: 503 });
  }

  const body = await readJson(request, BodySchema);
  if (!body.ok) return body.response;
  if (!(await consume("write", auth.userId))) return tooManyRequests("write");

  const db = createAdminClient();
  const { count } = await db
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", auth.userId);
  if ((count ?? 0) >= MAX_DEVICES) {
    // Le plus ancien appareil cède sa place.
    const { data: oldest } = await db
      .from("push_subscriptions")
      .select("id")
      .eq("user_id", auth.userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (oldest) await db.from("push_subscriptions").delete().eq("id", oldest.id);
  }

  const { error } = await db.from("push_subscriptions").upsert(
    {
      user_id: auth.userId,
      endpoint: body.data.endpoint,
      p256dh: body.data.keys.p256dh,
      auth: body.data.keys.auth,
    },
    { onConflict: "endpoint" },
  );
  if (error) throw error;

  await sendPush(db, auth.userId, {
    title: "Notifications activées",
    body: "Tu seras prévenu ici avant chaque échéance.",
    url: "/alertes",
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(request: Request) {
  const auth = await requireUser();
  if (!auth) return NextResponse.json({ error: "non authentifié" }, { status: 401 });

  const endpoint = new URL(request.url).searchParams.get("endpoint");
  const db = createAdminClient();
  const query = db.from("push_subscriptions").delete().eq("user_id", auth.userId);
  const { error } = await (endpoint ? query.eq("endpoint", endpoint) : query);
  if (error) throw error;
  return NextResponse.json({ ok: true });
}
