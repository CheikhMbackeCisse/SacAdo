-- SacAdo — branchement de coefficient_visibilite dans le classement
-- (TACHE_yuupee_integration_complete.md §6 / TACHE_kits_impression_classement.md
-- Chantier C). La colonne existe depuis 0072 (posée à 1.00 partout, neutre) ;
-- cette migration la fait enfin agir sur le score, plus une règle générique
-- de survalorisation par tranche de prix. À exécuter après 0075. Idempotent.
--
-- Deux mécanismes distincts, volontairement séparés :
--   1. `coefficient_visibilite` : signal éditorial posé à la main sur un
--      produit donné (ex. 0.30 sur les PC portables/bureau Yuupee). Statique,
--      modifiable en admin, ne dépend de rien d'autre.
--   2. Le boost "ordinateurs 100 000 à 250 000 FCFA, tous fournisseurs, ×1.50"
--      n'est PAS stocké en dur sur les produits : un prix qui change de
--      tranche (promo, renégociation) doit changer de statut immédiatement,
--      sans re-passer par un script d'import. Calculé à chaque recalcul
--      nightly à partir du prix et de la sous-catégorie courants.
--
-- Le score stocké (score_global, score_details) est donc TOUJOURS déjà
-- multiplié par le coefficient effectif — apercu_classement() doit faire de
-- même pour rester cohérent avec ce qui s'affiche réellement.

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
    greatest(0, 1 - (extract(epoch from now() - p.created_at) / 86400.0) / 60.0) as fraicheur,
    -- Coefficient effectif : éditorial × boost de tranche de prix (§6/Chantier C).
    coalesce(p.coefficient_visibilite, 1.00)
      * case
          when sc.slug in ('ordinateurs-portables', 'ordinateurs-de-bureau')
               and p.prix between 100000 and 250000
          then 1.50
          else 1.00
        end                                                            as coeff_effectif
  from produits p
  join agg    on agg.produit_id = p.id
  join saison on saison.produit_id = p.id
  left join sous_categories sc on sc.id = p.sous_categorie_id;

  select min(taux_lisse), max(taux_lisse), min(coeff_saison), max(coeff_saison)
  into perf_lo, perf_hi, sais_lo, sais_hi
  from tmp_brut;

  select min(marge_pct), max(marge_pct) into marge_lo, marge_hi
  from tmp_brut where marge_pct is not null;

  create temporary table tmp_scores on commit drop as
  select
    b.produit_id,
    b.vues_30j,
    public.normaliser_01(b.taux_lisse, perf_lo, perf_hi)              as perf,
    public.normaliser_01(b.coeff_saison, sais_lo, sais_hi)            as sais,
    case when b.marge_pct is null then 0.5
         else public.normaliser_01(b.marge_pct, marge_lo, marge_hi) end as marge,
    round(b.fraicheur, 6)                                             as frais,
    b.coeff_effectif                                                  as coeff
  from tmp_brut b;

  update produits p set
    score_global = round(
      s.coeff * (w_perf * s.perf + w_sais * s.sais + w_marge * s.marge + w_frais * s.frais), 6),
    score_details = jsonb_build_object(
      'performance',  round(s.perf, 4),
      'saisonnalite', round(s.sais, 4),
      'marge',        round(s.marge, 4),
      'fraicheur',    round(s.frais, 4),
      'coefficient',  round(s.coeff, 4),
      'score',        round(s.coeff * (w_perf * s.perf + w_sais * s.sais + w_marge * s.marge + w_frais * s.frais), 4),
      'vues_30j',     s.vues_30j,
      'calcule_le',   now()
    ),
    vues_30j = s.vues_30j
  from tmp_scores s
  where s.produit_id = p.id;
end $$;

-- ============================================================================
-- apercu_classement() : même coefficient, pour que l'écran admin (poids
-- ajustables) reste cohérent avec le vrai calcul nightly ci-dessus.
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
          coalesce(p.score_details ->> 'coefficient', '1')::numeric
        * (
            coalesce((p_poids ->> 'performance')::numeric, 0.45)
              * coalesce((p.score_details ->> 'performance')::numeric, 0.5)
          + coalesce((p_poids ->> 'saisonnalite')::numeric, 0.30)
              * coalesce((p.score_details ->> 'saisonnalite')::numeric, 0.5)
          + coalesce((p_poids ->> 'marge')::numeric, 0.15)
              * coalesce((p.score_details ->> 'marge')::numeric, 0.5)
          + coalesce((p_poids ->> 'fraicheur')::numeric, 0.10)
              * coalesce((p.score_details ->> 'fraicheur')::numeric, 0.5)
          )
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

-- Recalcul immédiat : sans ça, le nouveau coefficient n'agit qu'à 3h cette nuit.
select public.calculer_score_global();

-- ============================================================================
-- Contrôles post-exécution (à lancer après la migration)
-- ============================================================================
-- select nom, prix, coefficient_visibilite, score_details->>'coefficient' as coeff_applique,
--        score_global
--   from produits
--   where sous_categorie_id in (select id from sous_categories where slug in ('ordinateurs-portables','ordinateurs-de-bureau'))
--   order by score_global desc;
-- -- Les PC Yuupee (coefficient_visibilite=0.30) doivent sortir après les
-- -- machines à 100 000-250 000 (boost x1.50), tous fournisseurs confondus.
