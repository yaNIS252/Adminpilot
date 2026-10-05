import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/require-user";
import { checkLimit } from "@/lib/billing/quotas";
import { ACCEPTED_MIME_TYPES, MAX_UPLOAD_BYTES } from "@/lib/constants";
import { hashFile } from "@/lib/ingest/dedupe";
import { enqueue } from "@/lib/ingest/pipeline";
import { wakeDrain } from "@/lib/ingest/wake";
import { sniffMimeType } from "@/lib/ingest/sniff";
import { consume, tooManyRequests } from "@/lib/rate-limit";
import { buildKey, uploadRaw } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Upload d'un document.
 *
 * Même pipeline que l'ingestion mail : on stocke, on dépose un job, on répond.
 * L'extraction se fait au drain — l'utilisateur n'attend pas Claude devant un
 * écran de chargement, il voit son document arriver puis s'enrichir.
 */

const EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth) {
    return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "fichier manquant" }, { status: 400 });
  }

  if (!(ACCEPTED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return NextResponse.json(
      { error: `type non accepté : ${file.type || "inconnu"}` },
      { status: 415 },
    );
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `fichier trop volumineux (max ${MAX_UPLOAD_BYTES / 1024 / 1024} Mo)` },
      { status: 413 },
    );
  }

  if (!(await consume("upload", auth.userId))) {
    return tooManyRequests("upload");
  }

  const quota = await checkLimit(auth.userId, auth.profile.plan, "documents");
  if (!quota.allowed) {
    return NextResponse.json(
      {
        error: "quota atteint",
        feature: "documents",
        current: quota.current,
        max: quota.max,
      },
      { status: 402 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Le type déclaré vient du client : on vérifie qu'il correspond au contenu
  // réel. C'est le type RECONNU qui est retenu ensuite, jamais le type annoncé.
  const actualType = sniffMimeType(buffer);
  if (!actualType || actualType !== file.type) {
    return NextResponse.json(
      {
        error: "le contenu du fichier ne correspond pas à son type déclaré",
        declared: file.type || "inconnu",
        detected: actualType ?? "non reconnu",
      },
      { status: 415 },
    );
  }

  const contentHash = hashFile(buffer);

  const key = buildKey({
    userId: auth.userId,
    source: "upload",
    contentHash,
    extension: EXTENSIONS[actualType] ?? "bin",
  });

  await uploadRaw({ key, body: buffer, contentType: actualType });

  const result = await enqueue({
    userId: auth.userId,
    source: "upload",
    contentHash,
    rawUrl: key,
    mimeType: actualType,
    originalFilename: file.name,
  });

  // Réveil immédiat de l'analyse, comme à la réception d'un e-mail : sans
  // lui, le document attendait la tâche planifiée du lendemain matin.
  // Échec sans conséquence : la tâche planifiée rattrapera.
  if (result.status !== "duplicate") {
    wakeDrain(request.url);
  }

  // Le même fichier envoyé deux fois n'est pas une erreur : on le signale
  // plutôt que de faire croire à un nouvel ajout.
  return NextResponse.json(
    { ...result, filename: file.name },
    { status: result.status === "duplicate" ? 200 : 202 },
  );
}
