-- SacAdo — Marketplace V2, espace vendeur : table `commissions`
-- À exécuter APRÈS 0013, dans le SQL Editor Supabase.
-- Idempotent : peut être relancé sans erreur.
--
-- La commission SacAdo prélevée sur un produit vendeur dépend de sa
-- catégorie (affinable par sous-catégorie). Le taux vit en base pour être
-- modifiable dans l'admin sans toucher au code (ESPACE_VENDEUR_NEGOCIATION.md §1).
--
-- Résolution du taux applicable à un produit (du plus précis au plus large) :
--   1. ligne dont `sous_categorie_id` = la sous-catégorie du produit ;
--   2. sinon, ligne dont `categorie_id` = la catégorie du produit ;
--   3. sinon, ligne globale (les deux colonnes NULL) ;
--   4. repli code : 10 %.
--
-- Le calcul commission / net est TOUJOURS refait côté serveur : l'affichage
-- « en direct » dans le formulaire vendeur n'est qu'indicatif.

-- ============================================================================
-- TABLE
-- ============================================================================
create table if not exists commissions (
  id bigint generated always as identity primary key,
  -- Portée : (null, null) = taux global ; (categorie_id, null) = taux catégorie ;
  -- (null, sous_categorie_id) = taux sous-catégorie. Jamais les deux non-null.
  categorie_id bigint references categories (id) on delete cascade,
  sous_categorie_id bigint references sous_categories (id) on delete cascade,
  taux numeric(5, 2) not null default 10 check (taux >= 0 and taux <= 100),
  created_at timestamptz not null default now(),
  constraint commissions_portee_check check (
    categorie_id is null or sous_categorie_id is null
  )
);

-- Un seul taux par cible (y compris la ligne globale, mappée sur (-1, -1)).
create unique index if not exists commissions_cible_unique
  on commissions (coalesce(categorie_id, -1), coalesce(sous_categorie_id, -1));

create index if not exists idx_commissions_categorie on commissions (categorie_id);
create index if not exists idx_commissions_sous_categorie on commissions (sous_categorie_id);

-- ============================================================================
-- SEED : taux global par défaut 10 %
-- ============================================================================
insert into commissions (categorie_id, sous_categorie_id, taux)
select null, null, 10
where not exists (
  select 1 from commissions where categorie_id is null and sous_categorie_id is null
);

-- ============================================================================
-- RLS : lecture publique (taux non sensible), écriture via service_role
-- ============================================================================
alter table commissions enable row level security;

drop policy if exists "Lecture publique commissions" on commissions;
create policy "Lecture publique commissions" on commissions
  for select using (true);
