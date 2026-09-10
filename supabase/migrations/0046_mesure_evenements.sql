-- SacAdo — Couche de mesure (TACHE_algorithme_classement.md « chantier C »)
-- À exécuter dans le SQL Editor Supabase, APRÈS 0045.
-- Additive + idempotente. Peut être rejouée.
--
-- L'accueil devient un flux classé (TACHE_algorithme_classement.md). Le score
-- et les affinités se calculent HORS LIGNE à partir des signaux des visiteurs.
-- Cette migration pose :
--   1. l'extension pg_cron (les travaux planifiés des lots suivants) ;
--   2. la table `evenements` : un signal brut par ligne (vue produit, vue
--      catégorie, recherche, ajout panier, commande). JAMAIS lue par une
--      requête d'affichage — seulement par les fonctions de calcul nocturnes /
--      horaires. RLS active, sans policy : écriture via service_role seulement.
--   3. `produits.prix_achat` : base de la composante « marge » du score global.
--
-- Identité : `session_id` = cookie anonyme `sacado_sid` (posé par le middleware).
-- `client_id` reste NULL tant que le visiteur n'a pas commandé ; il est
-- rétro-rempli à la première commande (fusion de session, lot suivant).

-- ============================================================================
-- 1. pg_cron
-- ============================================================================
create extension if not exists pg_cron;

-- ============================================================================
-- 2. Table evenements
-- ============================================================================
create table if not exists evenements (
  id bigint generated always as identity primary key,
  session_id text not null,
  client_id bigint references clients (id) on delete set null,
  type text not null check (type in (
    'vue_produit', 'vue_categorie', 'recherche', 'ajout_panier', 'commande'
  )),
  produit_id bigint references produits (id) on delete cascade,
  categorie_id bigint references categories (id) on delete set null,
  sous_categorie_id bigint references sous_categories (id) on delete set null,
  recherche text,
  cree_le timestamptz not null default now()
);

-- Fenêtres glissantes (30 j performance, 90 j affinités) + agrégats par produit
-- et par sous-catégorie : tous les accès des fonctions de calcul filtrent sur
-- `cree_le` et regroupent sur un de ces axes.
create index if not exists evenements_cree_le_idx on evenements (cree_le);
create index if not exists evenements_produit_idx on evenements (produit_id, cree_le);
create index if not exists evenements_session_idx on evenements (session_id, cree_le);
create index if not exists evenements_client_idx on evenements (client_id, cree_le);
create index if not exists evenements_sous_categorie_idx
  on evenements (sous_categorie_id, cree_le);

alter table evenements enable row level security;
-- Aucune policy : ni le rôle anon ni le rôle authenticated ne lisent ou
-- n'écrivent cette table. Tout passe par le service_role (API /api/mesure,
-- action de commande, fonctions de calcul).

-- ============================================================================
-- 3. produits.prix_achat (FCFA) — base de la composante « marge »
-- ============================================================================
-- NULL = coût inconnu : le produit ne sera ni avantagé ni pénalisé par la
-- marge (traité comme neutre dans calculer_score_global(), lot suivant).
alter table produits
  add column if not exists prix_achat integer check (prix_achat is null or prix_achat >= 0);

-- ============================================================================
-- Contrôles post-exécution
-- ============================================================================
-- select extname from pg_extension where extname = 'pg_cron';
-- select count(*) from evenements;
-- select type, count(*) from evenements group by type order by 2 desc;
