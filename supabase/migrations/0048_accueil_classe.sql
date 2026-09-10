-- SacAdo — Accueil classé (TACHE_algorithme_classement.md §4)
-- À exécuter dans le SQL Editor Supabase, APRÈS 0047.
-- Additive + idempotente. Peut être rejouée.
--
-- L'accueil devient un flux de produits classé. Cette fonction fait TOUT le
-- travail lourd en base, sur des colonnes indexées, SANS jamais lire
-- `evenements` :
--   - exclusions : sans photo, non publié, en rupture, délai > 6 j, exclu à la main ;
--   - quota de diversité : 3 produits maximum par sous-catégorie ;
--   - drapeau d'éligibilité à l'exploration : < 50 vues sur 30 j ET score
--     au-dessus de la médiane du catalogue.
--
-- L'assemblage final (places d'exploration réservées, épinglages, et plus tard
-- l'entrelacement par bénéficiaire) se fait côté application à partir de ce
-- pool — voir getAccueilProduits() dans lib/supabase/queries.ts.

-- Les tables de configuration du classement (créées en 0047) ne doivent pas
-- être exposées à l'API publique : RLS active sans policy. La fonction
-- `accueil_classement` ci-dessous est SECURITY DEFINER pour pouvoir quand même
-- lire `classement_manuel` ; les fonctions de calcul le sont déjà.
alter table config_classement   enable row level security;
alter table saisons             enable row level security;
alter table saisons_categories  enable row level security;
alter table classement_manuel   enable row level security;

create or replace function public.accueil_classement(p_limit int default 20)
returns table (
  produit_id bigint,
  sous_categorie_id bigint,
  score_global numeric,
  epingle_position int,
  exploration_eligible boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with eligibles as (
    select
      p.id,
      p.sous_categorie_id,
      p.score_global,
      p.vues_30j,
      cm.position as epingle_position
    from produits p
    left join classement_manuel cm on cm.produit_id = p.id
    where p.statut_publication = 'publie'
      and coalesce(cm.exclu, false) = false
      -- au moins une photo (principale ou galerie ; `photos` est du jsonb)
      and (
        p.photo is not null
        or (jsonb_typeof(p.photos) = 'array' and jsonb_array_length(p.photos) > 0)
      )
      -- pas en rupture
      and p.stock > 0
      and p.statut <> 'epuise'
      -- délai <= 6 jours (la contrainte ne laisse que '24h' / '6j' aujourd'hui,
      -- la règle reste explicite pour l'avenir)
      and p.delai in ('24h', '6j')
  ),
  mediane as (
    select percentile_cont(0.5) within group (order by el.score_global) as m
    from eligibles el
  ),
  classes as (
    select
      e.*,
      row_number() over (
        partition by e.sous_categorie_id
        order by e.score_global desc, e.id
      ) as rang_sc
    from eligibles e
  )
  select
    c.id,
    c.sous_categorie_id,
    c.score_global,
    c.epingle_position,
    (c.vues_30j < 50 and c.score_global > coalesce((select m from mediane), 0)) as exploration_eligible
  from classes c
  -- quota : 3 max par sous-catégorie ; un produit épinglé passe toujours
  where c.rang_sc <= 3 or c.epingle_position is not null
  order by c.score_global desc, c.id
  limit greatest(p_limit * 10, 200);
$$;

-- Lecture publique (client anon) : la fonction ne renvoie que des ids + score,
-- aucune donnée sensible.
grant execute on function public.accueil_classement(int) to anon, authenticated;

-- ============================================================================
-- Contrôle post-exécution
-- ============================================================================
-- select * from public.accueil_classement(20);
