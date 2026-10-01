-- SacAdo — PROMPT_ADMIN Lot 2 : notifications push admin + badges de nouveauté
-- À exécuter APRÈS 0103, dans le SQL Editor Supabase. Idempotent.
--
-- abonnements_push_admin : abonnement push du fondateur (même mécanique que
-- push_subscriptions pour les vendeurs, cf. 0040), déclenché à chaque nouvelle
-- commande reçue.
--
-- admin_etat_lecture : jusqu'où le fondateur a « lu » une section (Commandes,
-- Livraisons). Le badge affiché = nombre de lignes dont l'id dépasse
-- dernier_id_vu ; ouvrir l'onglet fait remonter dernier_id_vu au max courant.

create table if not exists abonnements_push_admin (
  id         bigint generated always as identity primary key,
  admin_user_id uuid not null references admins (user_id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  cree_le    timestamptz not null default now()
);

create index if not exists idx_abonnements_push_admin_user on abonnements_push_admin (admin_user_id);

alter table abonnements_push_admin enable row level security;
-- Aucune policy publique : lecture / écriture réservées au service_role.

create table if not exists admin_etat_lecture (
  admin_user_id   uuid not null references admins (user_id) on delete cascade,
  section         text not null check (section in ('commandes', 'livraisons')),
  dernier_id_vu   bigint not null default 0,
  maj_le          timestamptz not null default now(),
  primary key (admin_user_id, section)
);

alter table admin_etat_lecture enable row level security;
-- Aucune policy publique : lecture / écriture réservées au service_role.
