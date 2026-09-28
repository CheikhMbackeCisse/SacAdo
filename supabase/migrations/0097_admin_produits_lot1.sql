-- SacAdo — ADMIN.md Lot 1 (suite) : mise en avant + historique des prix.
-- À exécuter dans le SQL Editor Supabase. Idempotent.

-- Mise en avant sur l'accueil (case à cocher dans la fiche produit).
alter table produits
  add column if not exists mise_en_avant boolean not null default false;

-- Historique des changements de prix : une ligne par changement, posée par le
-- serveur (jamais par le client). Simple : pas de colonne "qui" puisqu'il n'y
-- a qu'une seule connexion admin (CLAUDE.md §3).
create table if not exists historique_prix_produits (
  id bigint generated always as identity primary key,
  produit_id integer not null references produits(id) on delete cascade,
  ancien_prix numeric not null,
  nouveau_prix numeric not null,
  modifie_le timestamptz not null default now()
);

create index if not exists idx_historique_prix_produit
  on historique_prix_produits (produit_id, modifie_le desc);

alter table historique_prix_produits enable row level security;
-- Aucune policy publique : lu et écrit uniquement par le serveur admin
-- (supabaseAdmin, service_role), comme `factures`.
