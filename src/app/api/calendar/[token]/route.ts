import { NextResponse } from "next/server";

import { buildCalendar } from "@/lib/calendar";
import { siteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Agenda iCal d'un compte, lu par Google Agenda, Apple ou Outlook sans
 * session : le jeton secret de l'adresse tient lieu de connexion. Réservé aux
 * formules payantes ; repassé en gratuit, l'agenda se vide au lieu de
 * renvoyer une erreur que l'appli d'agenda afficherait en boucle.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const clean = token.replace(/\.ics$/, "");
  if (!/^[0-9a-f]{64}$/.test(clean)) {
    return NextResponse.json({ error: "introuvable" }, { status: 404 });
  }

  const db = createAdminClient();
  const { data: profile } = await db
    .from("profiles")
    .select("id, plan")
    .eq("calendar_token", clean)
    .is("deleted_at", null)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: "introuvable" }, { status: 404 });

  // Premium : relecture demandée toutes les heures au lieu de deux fois par jour.
  const premium = profile.plan === "family";
  const body =
    profile.plan === "free"
      ? "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//AdminPilot//Echeances//FR\r\nX-WR-CALNAME:AdminPilot\r\nEND:VCALENDAR\r\n"
      : await buildCalendar(db, profile.id, siteUrl(), premium ? "PT1H" : "PT12H");

  return new NextResponse(body, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'inline; filename="adminpilot.ics"',
      "cache-control": `private, max-age=${premium ? 300 : 900}`,
    },
  });
}
