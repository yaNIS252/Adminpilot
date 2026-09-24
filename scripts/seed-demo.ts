/**
 * Jeu de démonstration — développement uniquement.
 *
 * Crée un compte de test peuplé d'abonnements et de documents réalistes, puis
 * imprime un lien de connexion à usage unique. Permet de regarder l'interface
 * avec de vraies données plutôt qu'avec des écrans vides.
 *
 * Les données sont volontairement variées : cycles différents, confiances
 * différentes, échéances proches et lointaines. C'est ce qui fait ressortir
 * les problèmes d'affichage qu'un jeu uniforme masquerait.
 *
 * Usage : npm run seed:demo
 */

import { createClient } from "@supabase/supabase-js";

import type { Database } from "../src/lib/supabase/types";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const EMAIL = "demo@adminpilot.test";

const admin = createClient<Database>(URL, SERVICE, {
  auth: { persistSession: false },
});

/** Date à N jours d'aujourd'hui, au format ISO court. */
function inDays(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const SUBSCRIPTIONS = [
  // Confiance haute : affichage normal.
  { provider: "Netflix", amount: 13.49, cycle: "monthly", category: "streaming", next: inDays(3), confidence: 0.95, confirmed: true },
  { provider: "Free Mobile", amount: 19.99, cycle: "monthly", category: "telecom", next: inDays(11), confidence: 0.92, confirmed: true },
  { provider: "EDF", amount: 86.89, cycle: "monthly", category: "energie", next: inDays(18), confidence: 0.88, confirmed: true },
  { provider: "Spotify", amount: 11.99, cycle: "monthly", category: "streaming", next: inDays(24), confidence: 0.94, confirmed: true },
  // Annuel : teste la conversion en équivalent mensuel dans le total.
  { provider: "MAIF", amount: 384.0, cycle: "yearly", category: "assurance", next: inDays(87), confidence: 0.91, confirmed: true },
  { provider: "Amazon Prime", amount: 69.9, cycle: "yearly", category: "logiciel", next: inDays(140), confidence: 0.89, confirmed: true },
  // Confiance basse : doit apparaître en file de revue, sans alerte.
  { provider: "Canal+", amount: 24.99, cycle: "monthly", category: "streaming", next: inDays(9), confidence: 0.42, confirmed: false },
  // Montant inconnu : l'affichage doit tenir sans casser le total.
  { provider: "Deliveroo Plus", amount: null, cycle: "unknown", category: "logiciel", next: null, confidence: 0.35, confirmed: false },
] as const;

const DOCUMENTS = [
  { name: "Facture_EDF_2026-08.pdf", category: "facture", deadline: inDays(6), confidence: 0.93 },
  { name: "Contrat_MAIF_Habitation_2026.pdf", category: "assurance", deadline: null, confidence: 0.9 },
  { name: "Avis_Impots_2026.pdf", category: "impots", deadline: inDays(41), confidence: 0.96 },
  { name: "Quittance_Loyer_2026-09.pdf", category: "logement", deadline: null, confidence: 0.87 },
  { name: "Facture_Free_2026-09.pdf", category: "facture", deadline: null, confidence: 0.91 },
] as const;


/**
 * PDF minimal mais valide.
 *
 * Sans fichier réellement déposé, « Ouvrir » échoue : l'URL signée pointerait
 * vers un objet inexistant. Le jeu de démonstration ne servirait alors qu'à
 * moitié.
 */
function tinyPdf(title: string): Buffer {
  // Les parenthèses et antislashs délimitent les chaînes en PDF : les laisser
  // passer casserait le flux de contenu.
  const text = title.replace(/[()\\]/g, "");
  const stream = `BT /F1 16 Tf 60 760 Td (${text}) Tj ET`;

  const body = [
    "%PDF-1.4",
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj",
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj",
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>endobj",
    "4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj",
    `5 0 obj<</Length ${stream.length}>>stream`,
    stream,
    "endstream endobj",
    "trailer<</Root 1 0 R>>",
  ].join("\n");

  return Buffer.from(body, "latin1");
}

async function main() {
  // Repart d'un état propre : rejouer le seed ne doit pas empiler des doublons.
  const { data: existing } = await admin.auth.admin.listUsers();
  const previous = existing.users.find((user) => user.email === EMAIL);
  if (previous) {
    console.log("Suppression du compte de démonstration précédent…");
    await admin.auth.admin.deleteUser(previous.id);
  }

  console.log("Création du compte…");
  const { data: created, error } = await admin.auth.admin.createUser({
    email: EMAIL,
    email_confirm: true,
    user_metadata: { full_name: "Yanis Demo" },
  });
  if (error) throw error;

  const userId = created.user!.id;
  await new Promise((resolve) => setTimeout(resolve, 1200));

  // L'onboarding est considéré comme fait, sinon le layout redirige.
  await admin
    .from("profiles")
    .update({ gmail_forward_verified: true })
    .eq("id", userId);

  console.log("Abonnements…");
  const { data: subs, error: subError } = await admin
    .from("subscriptions")
    .insert(
      SUBSCRIPTIONS.map((sub) => ({
        user_id: userId,
        provider: sub.provider,
        amount: sub.amount,
        cycle: sub.cycle,
        category: sub.category,
        next_renewal: sub.next,
        confidence: sub.confidence,
        confirmed_by_user: sub.confirmed,
      })),
    )
    .select("id, provider, next_renewal, confidence");
  if (subError) throw subError;

  console.log("Documents…");

  // Le fichier est réellement déposé dans le stockage : sans lui, « Ouvrir »
  // émettrait une URL signée vers un objet inexistant, et la moitié de l'écran
  // documents serait intestable.
  await Promise.all(
    DOCUMENTS.map((doc, index) =>
      admin.storage
        .from("documents")
        .upload(`${userId}/upload/demo-${index}.pdf`, tinyPdf(doc.name), {
          contentType: "application/pdf",
          upsert: true,
        }),
    ),
  );

  const { error: docError } = await admin.from("documents").insert(
    DOCUMENTS.map((doc, index) => ({
      user_id: userId,
      file_url: `${userId}/upload/demo-${index}.pdf`,
      filename_original: `scan-${index}.pdf`,
      filename_ai: doc.name,
      mime_type: "application/pdf",
      category: doc.category,
      deadline: doc.deadline,
      confidence: doc.confidence,
    })),
  );
  if (docError) throw docError;

  console.log("Alertes…");
  const alerts = (subs ?? [])
    .filter((sub) => sub.next_renewal && sub.confidence >= 0.4)
    .flatMap((sub) =>
      [7, 1].map((offset) => {
        const date = new Date(`${sub.next_renewal}T00:00:00Z`);
        date.setUTCDate(date.getUTCDate() - offset);
        return {
          user_id: userId,
          ref_type: "subscription",
          ref_id: sub.id,
          title: `${sub.provider} se renouvelle`,
          message: `Prochaine échéance le ${sub.next_renewal}.`,
          alert_date: date.toISOString().slice(0, 10),
          dedup_key: `subscription:${sub.id}:${sub.next_renewal}:j-${offset}`,
        };
      }),
    )
    .filter((alert) => alert.alert_date >= new Date().toISOString().slice(0, 10));

  if (alerts.length) {
    const { error: alertError } = await admin.from("alerts").insert(alerts);
    if (alertError) throw alertError;
  }

  console.log("Lien de connexion…");
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: EMAIL,
    options: { redirectTo: `${SITE}/dashboard` },
  });
  if (linkError) throw linkError;

  console.log(`
Jeu de démonstration prêt.
  ${SUBSCRIPTIONS.length} abonnements · ${DOCUMENTS.length} documents · ${alerts.length} alertes

Connexion (usage unique) :
${SITE}/auth/callback?token_hash=${link.properties.hashed_token}&type=magiclink&next=/dashboard
`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
