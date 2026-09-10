-- SacAdo — Comptes parents & bénéficiaires (TACHE_identite_et_beneficiaires.md
-- Partie 2). À exécuter APRÈS 0049. Additive + idempotente.
--
-- Un compte n'égale pas un élève : un parent commande pour plusieurs enfants de
-- niveaux différents. Fusionner leurs signaux donne un profil moyen qui ne
-- correspond à personne. Chaque bénéficiaire porte donc sa propre affinité.
--
-- DONNÉES SUR LES MINEURS : LE STRICT MINIMUM. Prénom + niveau suffisent. Pas
-- de date de naissance, pas de nom de famille, pas de photo.

-- ============================================================================
-- 1. beneficiaires
-- ============================================================================
create table if not exists beneficiaires (
  id bigint generated always as identity primary key,
  compte_id bigint not null references clients (id) on delete cascade,
  prenom text not null check (char_length(btrim(prenom)) between 1 and 40),
  niveau text check (niveau is null or char_length(niveau) <= 40),
  serie text check (serie is null or char_length(serie) <= 20),
  etablissement text check (etablissement is null or char_length(etablissement) <= 120),
  actif boolean not null default true,
  cree_le timestamptz not null default now()
);
create index if not exists beneficiaires_compte_idx on beneficiaires (compte_id) where actif;

-- ============================================================================
-- 2. affinites_beneficiaire
-- ============================================================================
create table if not exists affinites_beneficiaire (
  beneficiaire_id bigint not null references beneficiaires (id) on delete cascade,
  sous_categorie_id bigint not null references sous_categories (id) on delete cascade,
  poids numeric not null default 0,
  maj_le timestamptz not null default now(),
  primary key (beneficiaire_id, sous_categorie_id)
);

-- ============================================================================
-- 3. evenements.beneficiaire_id — attribution explicite (commande de kit)
-- ============================================================================
alter table evenements
  add column if not exists beneficiaire_id bigint references beneficiaires (id) on delete set null;
create index if not exists evenements_beneficiaire_idx
  on evenements (beneficiaire_id, cree_le) where beneficiaire_id is not null;

alter table beneficiaires          enable row level security;
alter table affinites_beneficiaire enable row level security;

-- ============================================================================
-- 4. calculer_affinites() — ajoute la couche bénéficiaire
-- ============================================================================
create or replace function public.calculer_affinites()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  drop table if exists tmp_ev;
  drop table if exists tmp_aff_s;
  drop table if exists tmp_aff_u;
  drop table if exists tmp_aff_b;

  create temporary table tmp_ev on commit drop as
  select
    e.session_id,
    e.client_id,
    e.beneficiaire_id,
    e.sous_categorie_id,
    (case e.type
       when 'commande'      then 5.0
       when 'ajout_panier'  then 3.0
       when 'recherche'     then 2.0
       when 'vue_produit'   then 1.0
       when 'vue_categorie' then 0.5
       else 0 end)
    * power(0.5, extract(epoch from now() - e.cree_le) / 86400.0 / 30.0) as poids
  from evenements e
  where e.sous_categorie_id is not null
    and e.cree_le >= now() - interval '90 days';

  -- Session : événements encore anonymes.
  create temporary table tmp_aff_s on commit drop as
  select session_id, sous_categorie_id, sum(poids) as poids
  from tmp_ev
  where client_id is null
  group by session_id, sous_categorie_id
  having sum(poids) > 0;

  -- Compte : événements rattachés à un client. Ce que le titulaire achète pour
  -- lui-même ET pour ses enfants sans distinction (l'affinité par enfant est à
  -- part, elle n'est PAS la somme des enfants).
  create temporary table tmp_aff_u on commit drop as
  select client_id as utilisateur_id, sous_categorie_id, sum(poids) as poids
  from tmp_ev
  where client_id is not null
  group by client_id, sous_categorie_id
  having sum(poids) > 0;

  -- Bénéficiaire : uniquement les événements explicitement attribués (commande
  -- d'un kit). Une mauvaise attribution est pire qu'une absence d'attribution.
  create temporary table tmp_aff_b on commit drop as
  select beneficiaire_id, sous_categorie_id, sum(poids) as poids
  from tmp_ev
  where beneficiaire_id is not null
  group by beneficiaire_id, sous_categorie_id
  having sum(poids) > 0;

  delete from affinites_session;
  insert into affinites_session (session_id, sous_categorie_id, poids)
  select session_id, sous_categorie_id, poids from tmp_aff_s;

  delete from affinites_utilisateur;
  insert into affinites_utilisateur (utilisateur_id, sous_categorie_id, poids)
  select utilisateur_id, sous_categorie_id, poids from tmp_aff_u;

  delete from affinites_beneficiaire;
  insert into affinites_beneficiaire (beneficiaire_id, sous_categorie_id, poids)
  select beneficiaire_id, sous_categorie_id, poids from tmp_aff_b;
end $$;

select public.calculer_affinites();

-- ============================================================================
-- Contrôles post-exécution
-- ============================================================================
-- select column_name from information_schema.columns
--   where table_name = 'beneficiaires' order by ordinal_position;
--   -> jamais de date_naissance / nom / photo
-- select count(*) from affinites_beneficiaire;
