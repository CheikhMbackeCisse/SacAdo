-- SacAdo — Panneau d'administration de l'algorithme + conformité
-- (TACHE_algorithme_classement.md §6 + TACHE_identite §1.5)
-- À exécuter APRÈS 0050. Additive + idempotente.
--
--   - apercu_classement()       : §6.2, classement que produiraient d'autres poids
--   - impressions_accueil       : §6.7, mesure du rendement de l'exploration
--   - reinitialiser_recommandations() : §1.5, « Réinitialiser mes recommandations »
--   - purges de rétention (pg_cron) : §1.5

-- ============================================================================
-- 1. Aperçu (§6.2) — recompose le score à partir des composantes déjà stockées
--    dans produits.score_details, SANS toucher produits ni recalculer.
-- ============================================================================
create or replace function public.apercu_classement(p_poids jsonb)
returns table (
  produit_id bigint,
  nom text,
  score_actuel numeric,
  score_apercu numeric,
  rang_actuel int,
  rang_apercu int
)
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select
      p.id,
      p.nom,
      p.score_global as score_actuel,
      round(
          coalesce((p_poids ->> 'performance')::numeric, 0.45)
            * coalesce((p.score_details ->> 'performance')::numeric, 0.5)
        + coalesce((p_poids ->> 'saisonnalite')::numeric, 0.30)
            * coalesce((p.score_details ->> 'saisonnalite')::numeric, 0.5)
        + coalesce((p_poids ->> 'marge')::numeric, 0.15)
            * coalesce((p.score_details ->> 'marge')::numeric, 0.5)
        + coalesce((p_poids ->> 'fraicheur')::numeric, 0.10)
            * coalesce((p.score_details ->> 'fraicheur')::numeric, 0.5)
      , 6) as score_apercu
    from produits p
    where p.statut_publication = 'publie'
      and p.score_details is not null
  ),
  classe as (
    select
      base.*,
      row_number() over (order by score_actuel desc, id) as ra,
      row_number() over (order by score_apercu desc, id) as rp
    from base
  )
  select id, nom, score_actuel, score_apercu, ra::int, rp::int
  from classe
  where rp <= 20 or ra <= 20
  order by rp;
$$;

grant execute on function public.apercu_classement(jsonb) to anon, authenticated;

-- ============================================================================
-- 2. Rendement de l'exploration (§6.7)
-- ============================================================================
-- Agrégat quotidien des produits affichés sur l'accueil, par origine
-- ('score' | 'exploration' | 'epingle'). Écrit best-effort par getAccueilFeed().
create table if not exists impressions_accueil (
  produit_id bigint not null references produits (id) on delete cascade,
  origine text not null check (origine in ('score', 'exploration', 'epingle')),
  jour date not null default current_date,
  n integer not null default 0,
  primary key (produit_id, origine, jour)
);
alter table impressions_accueil enable row level security;

create or replace function public.enregistrer_impressions_accueil(p_items jsonb)
returns void
language sql
security definer
set search_path = public
as $$
  insert into impressions_accueil (produit_id, origine, jour, n)
  select pr.id, it ->> 'origine', current_date, 1
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as it
  join produits pr on pr.id = (it ->> 'produit_id')::bigint
  where (it ->> 'origine') in ('score', 'exploration', 'epingle')
  on conflict (produit_id, origine, jour) do update set n = impressions_accueil.n + 1;
$$;

grant execute on function public.enregistrer_impressions_accueil(jsonb) to anon, authenticated;

-- Compare, sur une fenêtre, le taux de conversion (ajouts panier / impressions)
-- des produits affichés en exploration à ceux affichés par score.
create or replace function public.rendement_exploration(p_jours int default 30)
returns table (origine text, impressions bigint, ajouts_panier bigint, taux numeric)
language sql
stable
security definer
set search_path = public
as $$
  with imp as (
    select origine, sum(n) as impressions
    from impressions_accueil
    where jour >= current_date - (p_jours || ' days')::interval
    group by origine
  ),
  -- ajouts panier récents des produits, ventilés par l'origine sous laquelle ils
  -- ont été le plus vus sur la fenêtre (approché : origine dominante du produit).
  origine_produit as (
    select produit_id, origine,
      row_number() over (partition by produit_id order by sum(n) desc) as r
    from impressions_accueil
    where jour >= current_date - (p_jours || ' days')::interval
    group by produit_id, origine
  ),
  ajouts as (
    select op.origine, count(*) as ajouts_panier
    from evenements e
    join origine_produit op on op.produit_id = e.produit_id and op.r = 1
    where e.type = 'ajout_panier'
      and e.cree_le >= now() - (p_jours || ' days')::interval
    group by op.origine
  )
  select
    coalesce(imp.origine, ajouts.origine) as origine,
    coalesce(imp.impressions, 0) as impressions,
    coalesce(ajouts.ajouts_panier, 0) as ajouts_panier,
    case when coalesce(imp.impressions, 0) > 0
         then round(coalesce(ajouts.ajouts_panier, 0)::numeric / imp.impressions, 4)
         else 0 end as taux
  from imp
  full outer join ajouts on ajouts.origine = imp.origine;
$$;

grant execute on function public.rendement_exploration(int) to anon, authenticated;

-- ============================================================================
-- 3. « Réinitialiser mes recommandations » (§1.5)
-- ============================================================================
create or replace function public.reinitialiser_recommandations(
  p_client bigint,
  p_session text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- On supprime aussi les signaux bruts : sans ça, le recalcul horaire
  -- reconstruirait l'affinité une heure plus tard (la réinitialisation ne serait
  -- que cosmétique).
  if p_client is not null then
    delete from affinites_utilisateur where utilisateur_id = p_client;
    delete from affinites_beneficiaire
      where beneficiaire_id in (select id from beneficiaires where compte_id = p_client);
    delete from evenements where client_id = p_client;
  end if;
  if p_session is not null then
    delete from affinites_session where session_id = p_session;
    delete from evenements where session_id = p_session and client_id is null;
  end if;
end $$;

grant execute on function public.reinitialiser_recommandations(bigint, text) to anon, authenticated;

-- ============================================================================
-- 4. Rétention (§1.5) — purges nocturnes
-- ============================================================================
create or replace function public.purger_donnees_reco()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from affinites_session where maj_le < now() - interval '12 months';
  delete from evenements where cree_le < now() - interval '24 months';
  delete from impressions_accueil where jour < current_date - interval '120 days';
end $$;

do $$
begin
  perform cron.unschedule('purge_reco');
exception when others then
  null;
end $$;

select cron.schedule('purge_reco', '30 3 * * *', $$ select public.purger_donnees_reco(); $$);

-- ============================================================================
-- Contrôles post-exécution
-- ============================================================================
-- select * from public.apercu_classement('{"performance":0.2,"marge":0.5}'::jsonb) limit 10;
-- select * from public.rendement_exploration(30);
-- select jobname, schedule from cron.job order by jobname;
