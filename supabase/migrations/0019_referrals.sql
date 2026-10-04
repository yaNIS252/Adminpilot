-- Parrainage
--
-- Le filleul reçoit un mois de Pro dès que son transfert est réellement en
-- place ; le parrain reçoit le sien quand le filleul s'en sert vraiment
-- (abonnements détectés depuis ses e-mails) ou quand il paie. Les conditions
-- sont publiques (CGU, article « Parrainage ») ; les contrôles anti-abus, eux,
-- ne sont pas détaillés à l'écran.

-- ---------------------------------------------------------------- profiles

alter table profiles
  -- Code du lien de parrainage, non devinable : /p/<code>.
  add column referral_code text unique
    default lower(encode(gen_random_bytes(5), 'hex')),
  -- Pro offert (parrainage) jusqu'à cette date, sans abonnement Stripe.
  -- Non nul et futur ⇒ le plan `pro` vient de là, pas d'un paiement.
  add column bonus_pro_until timestamptz,
  -- Empreinte (SHA-256) de l'adresse qui transfère les e-mails, lue dans la
  -- demande de validation Gmail. Sert à repérer deux comptes alimentés par la
  -- même boîte. Jamais l'adresse en clair.
  add column forwarding_source_hash text;

update profiles
   set referral_code = lower(encode(gen_random_bytes(5), 'hex'))
 where referral_code is null;

alter table profiles alter column referral_code set not null;

create index profiles_forwarding_source_idx
  on profiles (forwarding_source_hash)
  where forwarding_source_hash is not null;

-- ---------------------------------------------------------------- referrals

create table referrals (
  id                 uuid primary key default gen_random_uuid(),
  referrer_id        uuid not null references profiles on delete cascade,
  -- Un compte n'est parrainé qu'une fois.
  referee_id         uuid not null unique references profiles on delete cascade,
  -- signed_up : inscrit, transfert pas encore en place
  -- pending   : filleul récompensé, parrain en attente de validation
  -- validated : parrain récompensé
  -- capped    : validé, mais plafond de mois offerts atteint
  -- blocked   : écarté par un contrôle anti-abus (affiché « en attente »)
  status             text not null default 'signed_up'
    check (status in ('signed_up', 'pending', 'validated', 'capped', 'blocked')),
  block_reason       text,
  -- Adresse du filleul ramenée à sa forme canonique (points et « +étiquette »
  -- retirés chez Gmail) : repère les variantes d'une même boîte.
  referee_email_norm text not null,
  -- Empreinte salée de l'adresse IP d'inscription, effacée après 30 jours.
  ip_hash            text,
  -- Comment le parrain a été récompensé : mois de Pro ou crédit Stripe.
  referrer_reward    text check (referrer_reward in ('bonus', 'credit')),
  created_at         timestamptz not null default now(),
  activated_at       timestamptz,
  validated_at       timestamptz
);

create index referrals_referrer_idx on referrals (referrer_id, created_at desc);
create index referrals_pending_idx on referrals (created_at) where status = 'pending';
create index referrals_ip_idx on referrals (ip_hash, created_at) where ip_hash is not null;
create index referrals_email_norm_idx on referrals (referee_email_norm);

-- Lu et écrit uniquement par le serveur (motifs de blocage compris).
alter table referrals enable row level security;
revoke all on referrals from anon, authenticated;
