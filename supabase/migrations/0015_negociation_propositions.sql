-- SacAdo — Marketplace V2, espace vendeur : négociation de prix (fil de propositions)
-- À exécuter APRÈS 0014, dans le SQL Editor Supabase.
-- Idempotent : peut être relancé sans erreur.
--
-- Avant publication, l'admin et le vendeur peuvent s'échanger des propositions
-- de prix (ESPACE_VENDEUR_NEGOCIATION.md §2). Chaque produit en négociation a un
-- « fil » : une liste de propositions { auteur, prix, date, statut }.
--
--   - `produits.statut_publication` gagne la valeur 'negociation'.
--   - Nouvelle table `negociation_propositions` = le fil, une ligne par proposition.
--
-- Le « prix courant » et « qui a la balle » ne sont PAS stockés : ils se
-- déduisent de la dernière proposition `en_cours` (voir lib/negociation.ts).
-- Le nombre de tours = nombre de lignes du fil (pour la limite d'allers-retours,
-- étape suivante).

-- ============================================================================
-- 1. statut_publication : ajouter 'negociation'
-- ============================================================================
alter table produits drop constraint if exists produits_statut_publication_check;
alter table produits add constraint produits_statut_publication_check
  check (statut_publication in ('en_attente', 'negociation', 'publie', 'refuse'));

-- ============================================================================
-- 2. Table negociation_propositions
-- ============================================================================
create table if not exists negociation_propositions (
  id bigint generated always as identity primary key,
  produit_id bigint not null references produits (id) on delete cascade,
  -- Qui a émis cette proposition.
  auteur text not null check (auteur in ('vendeur', 'admin')),
  -- Prix proposé, en FCFA (entier, pas de décimales).
  prix_propose integer not null check (prix_propose > 0),
  -- Statut de CETTE proposition (pas du produit) :
  --   en_cours : sur la table, attend une réponse de l'autre partie ;
  --   accepte  : c'est le prix retenu → le produit passe 'publie' ;
  --   refuse   : dépassée par une contre-proposition, ou négociation abandonnée.
  statut text not null default 'en_cours' check (statut in ('en_cours', 'accepte', 'refuse')),
  date timestamptz not null default now()
);

create index if not exists idx_negociation_propositions_produit
  on negociation_propositions (produit_id, date);

-- Une seule proposition 'en_cours' à la fois par produit (la « balle »).
create unique index if not exists negociation_propositions_une_en_cours
  on negociation_propositions (produit_id)
  where statut = 'en_cours';

-- ============================================================================
-- 3. RLS
-- ============================================================================
alter table negociation_propositions enable row level security;

-- Un vendeur lit le fil de SES produits uniquement (MARKETPLACE_V2.md §8).
-- L'écriture (créer / accepter / refuser une proposition) passe par le
-- service_role côté serveur (server actions des étapes suivantes) : aucune
-- policy insert/update/delete pour le rôle authenticated. L'admin lit tout via
-- service_role.
drop policy if exists "Vendeur lit son fil de negociation" on negociation_propositions;
create policy "Vendeur lit son fil de negociation" on negociation_propositions
  for select using (
    exists (
      select 1 from produits p
      where p.id = negociation_propositions.produit_id
        and p.vendeur_id = auth.uid()
    )
  );
