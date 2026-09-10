-- SacAdo — Score global de classement (TACHE_algorithme_classement.md §3 couche 1)
-- À exécuter dans le SQL Editor Supabase, APRÈS 0046.
-- Additive + idempotente. Peut être rejouée.
--
-- Couche 1 du classement : un score identique pour tout le monde, recalculé
-- chaque nuit à 3h (pg_cron) et STOCKÉ dans `produits.score_global` (colonne
-- indexée). Aucune requête d'affichage ne recalcule ce score ni ne lit
-- `evenements`.
--
--   score_global = w_perf * performance    (défaut 0.45)
--                + w_sais * saisonnalite    (défaut 0.30)
--                + w_marge * marge          (défaut 0.15)
--                + w_frais * fraicheur      (défaut 0.10)
--
-- Les poids vivent dans `config_classement`, modifiables depuis l'admin
-- (lot suivant). Les modifier ne recalcule rien : un bouton « Recalculer
-- maintenant » le fait à la demande.

-- ============================================================================
-- 1. config_classement : les poids + l'interrupteur de personnalisation
-- ============================================================================
create table if not exists config_classement (
  cle text primary key,
  valeur numeric not null,
  maj_le timestamptz not null default now()
);

insert into config_classement (cle, valeur) values
  ('poids_performance',  0.45),
  ('poids_saisonnalite', 0.30),
  ('poids_marge',        0.15),
  ('poids_fraicheur',    0.10),
  ('poids_affinite',     0.60),  -- couche 2 (lot suivant) : score_final = score_global * (1 + 0.6 * affinite)
  ('perso_active',       1)      -- 1 = personnalisation active, 0 = score global seul pour tous
on conflict (cle) do nothing;

-- ============================================================================
-- 2. Saisons + coefficients par catégorie (§3.2)
-- ============================================================================
create table if not exists saisons (
  id bigint generated always as identity primary key,
  nom text not null,
  debut date not null,
  fin date not null,
  actif boolean not null default true
);

create table if not exists saisons_categories (
  saison_id bigint references saisons (id) on delete cascade,
  categorie_id bigint references categories (id) on delete cascade,
  coefficient numeric not null default 1.0 check (coefficient > 0),
  primary key (saison_id, categorie_id)
);

-- Seed du calendrier sénégalais (dates du cycle 2026-2027, MODIFIABLES depuis
-- l'admin — section 6.6). Un produit hors saison garde un coefficient de 1.0 :
-- il n'est jamais pénalisé, seulement moins poussé.
do $$
declare
  v_rentree     bigint;
  v_examens     bigint;
  v_projets     bigint;
  v_etablissement bigint;
begin
  if not exists (select 1 from saisons) then
    insert into saisons (nom, debut, fin) values
      ('Rentrée scolaire',        date '2026-08-15', date '2026-10-31') returning id into v_rentree;
    insert into saisons (nom, debut, fin) values
      ('Examens',                 date '2027-05-01', date '2027-07-15') returning id into v_examens;
    insert into saisons (nom, debut, fin) values
      ('Projets étudiants',       date '2026-11-01', date '2027-03-31') returning id into v_projets;
    insert into saisons (nom, debut, fin) values
      ('Rentrée établissements',  date '2026-08-01', date '2026-09-30') returning id into v_etablissement;

    insert into saisons_categories (saison_id, categorie_id, coefficient)
    select s.saison_id, c.id, s.coeff
    from (values
      (v_rentree,       'cahiers-papeterie',    1.5),
      (v_rentree,       'cartables-sacs',       1.5),
      (v_rentree,       'ecriture',             1.4),
      (v_rentree,       'fournitures-ecole',    1.4),
      (v_rentree,       'livres-manuels',       1.3),
      (v_rentree,       'art-dessin',           1.2),
      (v_examens,       'geometrie',            1.4),
      (v_examens,       'livres-manuels',       1.4),
      (v_examens,       'cahiers-papeterie',    1.3),
      (v_examens,       'fournitures-ecole',    1.2),
      (v_projets,       'electronique-arduino', 1.6),
      (v_projets,       'ordinateurs',          1.3),
      (v_etablissement, 'ordinateurs',          1.3),
      (v_etablissement, 'fournitures-ecole',    1.3),
      (v_etablissement, 'sport-eps',            1.3)
    ) as s(saison_id, slug, coeff)
    join categories c on c.slug = s.slug;
  end if;
end $$;

-- ============================================================================
-- 3. Classement manuel : épinglage + exclusion du flux (§6.4)
-- ============================================================================
create table if not exists classement_manuel (
  produit_id bigint primary key references produits (id) on delete cascade,
  position int,                       -- null = simple exclusion
  exclu boolean not null default false
);

-- ============================================================================
-- 4. Colonnes de score sur produits
-- ============================================================================
alter table produits
  add column if not exists score_global numeric not null default 0,
  add column if not exists score_details jsonb,
  -- Vues produit sur 30 j (brut, non pondéré) : sert au filtre « moins de 50
  -- vues » des places d'exploration (lot suivant), sans relire `evenements`.
  add column if not exists vues_30j integer not null default 0;

create index if not exists produits_score_global
  on produits (score_global desc)
  where statut_publication = 'publie';

-- `prix_achat` (coût d'achat) ne doit jamais transiter par l'API publique : les
-- requêtes storefront sélectionnent une liste de colonnes explicite
-- (COLONNES_PRODUIT_PUBLIC dans lib/supabase/queries.ts), jamais `select=*`.
-- L'admin lit via le service_role.

-- ============================================================================
-- 5. Helper : normalisation min-max bornée [0,1]
-- ============================================================================
create or replace function public.normaliser_01(x numeric, lo numeric, hi numeric)
returns numeric
language sql
immutable
as $$
  select case
    when x is null then 0.5
    when hi is null or lo is null or hi - lo <= 0 then 0.5
    else greatest(0, least(1, (x - lo) / (hi - lo)))
  end;
$$;

-- ============================================================================
-- 6. calculer_score_global() — recalcul complet du catalogue
-- ============================================================================
-- Toute la fonction s'exécute dans UNE transaction : le grand UPDATE final est
-- donc atomique (aucune requête d'affichage ne voit un état partiel).
create or replace function public.calculer_score_global()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  w_perf  numeric := coalesce((select valeur from config_classement where cle = 'poids_performance'), 0.45);
  w_sais  numeric := coalesce((select valeur from config_classement where cle = 'poids_saisonnalite'), 0.30);
  w_marge numeric := coalesce((select valeur from config_classement where cle = 'poids_marge'), 0.15);
  w_frais numeric := coalesce((select valeur from config_classement where cle = 'poids_fraicheur'), 0.10);
  taux_moyen numeric;
  perf_lo numeric; perf_hi numeric;
  sais_lo numeric; sais_hi numeric;
  marge_lo numeric; marge_hi numeric;
begin
  drop table if exists tmp_brut;
  drop table if exists tmp_scores;

  -- Taux de conversion moyen du catalogue sur 30 j (événements < 7 j ×2).
  select coalesce(
           sum(poids) filter (where type = 'ajout_panier')
           / nullif(sum(poids) filter (where type = 'vue_produit'), 0),
           0)
  into taux_moyen
  from (
    select type,
           case when cree_le >= now() - interval '7 days' then 2 else 1 end as poids
    from evenements
    where produit_id is not null
      and cree_le >= now() - interval '30 days'
      and type in ('vue_produit', 'ajout_panier')
  ) e;
  taux_moyen := coalesce(taux_moyen, 0);

  -- Valeurs brutes par produit.
  create temporary table tmp_brut on commit drop as
  with ev as (
    select produit_id, type,
           case when cree_le >= now() - interval '7 days' then 2 else 1 end as poids
    from evenements
    where produit_id is not null
      and cree_le >= now() - interval '30 days'
  ),
  agg as (
    select p.id as produit_id,
           coalesce(sum(ev.poids) filter (where ev.type = 'vue_produit'), 0)   as vues_pond,
           coalesce(sum(ev.poids) filter (where ev.type = 'ajout_panier'), 0)  as ajouts_pond,
           count(*) filter (where ev.type = 'vue_produit')                     as vues_30j
    from produits p
    left join ev on ev.produit_id = p.id
    group by p.id
  ),
  saison as (
    select p.id as produit_id,
           coalesce(
             exp(sum(ln(greatest(sc.coefficient, 0.01)))
                 filter (where sc.coefficient is not null)),
             1.0) as coeff
    from produits p
    left join saisons s
      on s.actif and current_date between s.debut and s.fin
    left join saisons_categories sc
      on sc.saison_id = s.id and sc.categorie_id = p.categorie_id
    group by p.id
  )
  select
    p.id as produit_id,
    agg.vues_30j,
    (agg.ajouts_pond + 5 * taux_moyen) / (agg.vues_pond + 5)          as taux_lisse,
    saison.coeff                                                       as coeff_saison,
    case when p.prix_achat is not null and p.prix > 0
         then (p.prix - p.prix_achat)::numeric / p.prix
         else null end                                                as marge_pct,
    greatest(0, 1 - (extract(epoch from now() - p.created_at) / 86400.0) / 60.0) as fraicheur
  from produits p
  join agg    on agg.produit_id = p.id
  join saison on saison.produit_id = p.id;

  select min(taux_lisse), max(taux_lisse), min(coeff_saison), max(coeff_saison)
  into perf_lo, perf_hi, sais_lo, sais_hi
  from tmp_brut;

  select min(marge_pct), max(marge_pct) into marge_lo, marge_hi
  from tmp_brut where marge_pct is not null;

  -- Scores normalisés + pondérés.
  create temporary table tmp_scores on commit drop as
  select
    b.produit_id,
    b.vues_30j,
    public.normaliser_01(b.taux_lisse, perf_lo, perf_hi)              as perf,
    public.normaliser_01(b.coeff_saison, sais_lo, sais_hi)            as sais,
    case when b.marge_pct is null then 0.5
         else public.normaliser_01(b.marge_pct, marge_lo, marge_hi) end as marge,
    round(b.fraicheur, 6)                                             as frais
  from tmp_brut b;

  update produits p set
    score_global = round(
      w_perf * s.perf + w_sais * s.sais + w_marge * s.marge + w_frais * s.frais, 6),
    score_details = jsonb_build_object(
      'performance',  round(s.perf, 4),
      'saisonnalite', round(s.sais, 4),
      'marge',        round(s.marge, 4),
      'fraicheur',    round(s.frais, 4),
      'score',        round(w_perf * s.perf + w_sais * s.sais + w_marge * s.marge + w_frais * s.frais, 4),
      'vues_30j',     s.vues_30j,
      'calcule_le',   now()
    ),
    vues_30j = s.vues_30j
  from tmp_scores s
  where s.produit_id = p.id;
end $$;

-- ============================================================================
-- 7. Planification pg_cron — chaque nuit à 3h (UTC = heure de Dakar)
-- ============================================================================
do $$
begin
  perform cron.unschedule('score_global');
exception when others then
  null; -- pas encore planifié
end $$;

select cron.schedule('score_global', '0 3 * * *',
  $$ select public.calculer_score_global(); $$);

-- Premier calcul immédiat (sinon score_global reste à 0 jusqu'à la nuit).
select public.calculer_score_global();

-- ============================================================================
-- Contrôles post-exécution
-- ============================================================================
-- select id, nom, score_global, score_details from produits order by score_global desc limit 20;
-- select jobname, schedule, active from cron.job where jobname = 'score_global';
-- select nom, debut, fin, actif from saisons;
