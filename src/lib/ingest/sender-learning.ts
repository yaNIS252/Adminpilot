import "server-only";

import { matchCatalogue, rootDomain } from "@/lib/cancel/links";
import { CONSUMER_MAIL_DOMAINS } from "@/lib/email/consumer-domains";
import { fingerprint } from "@/lib/referral/normalize";
import type { createAdminClient } from "@/lib/supabase/admin";

type Db = ReturnType<typeof createAdminClient>;

/**
 * Comptes distincts recevant leurs factures d'un même fournisseur depuis une
 * adresse pour qu'elle rejoigne le catalogue. Trois, et non un : une seule
 * observation peut venir d'une facture mal lue ou d'un expéditeur douteux, et
 * le catalogue alimente le filtre de tout le monde — un seul utilisateur
 * avec deux comptes ne doit pas pouvoir y glisser une adresse.
 */
const PROMOTION_THRESHOLD = 3;

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;

function addressOf(value: string): string | null {
  const bracketed = /<([^>]+)>/.exec(value)?.[1];
  const match = EMAIL.exec(bracketed ?? value);
  return match ? match[0].toLowerCase() : null;
}

function inboundDomain(): string {
  return (process.env.INBOUND_DOMAIN ?? "in.zylax.fr").toLowerCase();
}

/**
 * Expéditeur d'origine d'une facture.
 *
 * Par le filtre automatique, l'e-mail arrive tel quel : l'expéditeur est le
 * fournisseur. Transféré à la main, il arrive de la boîte de l'utilisateur,
 * et le fournisseur est cité dans l'en-tête du message transféré
 * (« De : Netflix <info@mailer.netflix.com> »).
 */
export function originalSender(from: string, body: string): string | null {
  const direct = addressOf(from);
  const directDomain = direct ? rootDomain(direct.split("@")[1] ?? "") : "";
  if (direct && !CONSUMER_MAIL_DOMAINS.has(directDomain)) return direct;

  const forwarded =
    /(?:message transf[ée]r[ée]|forwarded message|message d'origine|original message)[\s\S]{0,400}?(?:^|\n)\s*(?:de|from)\s*:\s*([^\n]+)/i.exec(
      body,
    )?.[1];
  return forwarded ? addressOf(forwarded) : direct;
}

/**
 * E-mail venant d'AdminPilot lui-même : nos rappels, nos confirmations, ou le
 * reçu Stripe de l'abonnement AdminPilot.
 *
 * Il n'a rien à analyser : l'abonnement AdminPilot est déjà suivi
 * automatiquement depuis Stripe, et le relire créerait un doublon. Un rappel
 * « Netflix se renouvelle » renvoyé par un filtre serait même pris pour une
 * facture Netflix, et pourrait tourner en boucle.
 */
export function isOwnMessage(input: { from: string; subject: string; body: string }): boolean {
  const sender = addressOf(input.from);
  const domain = inboundDomain();
  if (sender && (sender.endsWith(`@${domain}`) || sender.endsWith(`.${domain}`))) return true;

  // Reçu ou facture Stripe d'AdminPilot.
  const fromStripe = Boolean(sender && /(^|\.)stripe\.com$/.test(sender.split("@")[1] ?? ""));
  return fromStripe && /admin\s?pilot/i.test(`${input.subject}\n${input.body}`);
}

/** Vrai pour un fournisseur détecté qui serait AdminPilot lui-même. */
export function isAdminPilotProvider(provider: string): boolean {
  return /^admin\s?pilot\b/i.test(provider.trim());
}

/**
 * Retient l'adresse d'envoi d'une facture, et l'ajoute au catalogue quand
 * plusieurs comptes la confirment pour un fournisseur connu. Ne lève pas :
 * l'apprentissage ne doit jamais faire échouer l'analyse d'un e-mail.
 */
export async function learnSender(
  db: Db,
  input: { userId: string; from: string; body: string; provider: string; category: string | null },
) {
  try {
    const sender = originalSender(input.from, input.body);
    if (!sender) return;
    const domain = rootDomain(sender.split("@")[1] ?? "");
    // Messagerie grand public : l'adresse d'un particulier, pas d'une
    // entreprise. Elle ne sort jamais du compte de l'utilisateur.
    if (!domain || CONSUMER_MAIL_DOMAINS.has(domain) || domain === rootDomain(inboundDomain())) {
      return;
    }

    const userHash = fingerprint(`learn:${input.userId}`);
    const now = new Date().toISOString();

    const { data: existing } = await db
      .from("sender_candidates")
      .select("id, user_hashes, seen_count, promoted_at")
      .eq("sender_email", sender)
      .maybeSingle();

    const users = new Set(existing?.user_hashes ?? []);
    users.add(userHash);

    let candidateId = existing?.id ?? null;
    if (existing) {
      await db
        .from("sender_candidates")
        .update({
          user_hashes: [...users],
          seen_count: existing.seen_count + 1,
          last_seen: now,
        })
        .eq("id", existing.id);
    } else {
      const { data } = await db
        .from("sender_candidates")
        .insert({
          sender_email: sender,
          domain,
          provider: input.provider.slice(0, 120),
          category: input.category,
          user_hashes: [userHash],
        })
        .select("id")
        .single();
      candidateId = data?.id ?? null;
    }

    if (!candidateId || existing?.promoted_at || users.size < PROMOTION_THRESHOLD) return;

    // Rejoint le catalogue seulement pour un fournisseur déjà connu : un
    // nouveau fournisseur demande une fiche (catégorie, résiliation) vérifiée
    // à la main, il reste en attente dans `sender_candidates`.
    const match = await matchCatalogue(db, { provider: input.provider });
    if (!match) return;

    const { data: provider } = await db
      .from("known_providers")
      .select("sender_emails")
      .eq("id", match.id)
      .single();
    if (!provider) return;

    if (!provider.sender_emails.includes(sender)) {
      await db
        .from("known_providers")
        .update({ sender_emails: [...provider.sender_emails, sender] })
        .eq("id", match.id);
    }
    await db
      .from("sender_candidates")
      .update({ provider_id: match.id, promoted_at: now })
      .eq("id", candidateId);
  } catch (error) {
    console.error("[learnSender]", error);
  }
}
