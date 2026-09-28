-- SacAdo — CORRECTIONS_V11 lot 2 : accueil_classement() accepte un décalage.
-- À exécuter APRÈS 0092, dans le SQL Editor Supabase. Idempotente.
--
-- p_offset est appliqué APRÈS le calcul du quota par sous-catégorie
-- (rang_sc <= 3) et de l'éligibilité à l'exploration (médiane du score
-- global) : ces deux calculs portent toujours sur l'ensemble des produits
-- éligibles, jamais sur une seule page. Décaler/limiter le résultat final ne
-- change donc rien à ce qui est autorisé à apparaître, seulement à la
-- tranche renvoyée.
--
-- Non branché côté application pour l'instant (lib/accueil.ts continue de
-- rappeler avec un p_limit cumulé croissant, jamais d'offset) : le placement
-- des produits épinglés (position absolue dans le flux) et l'espacement des
-- places d'exploration (lib/accueil-classement.ts, assemblerAccueil) ont
-- besoin de la liste complète depuis le début pour rester corrects — les
-- calculer sur une page isolée casserait ces deux garanties. Le paramètre
-- est ajouté pour que la RPC accepte un décalage sans erreur (et pour un
-- futur appelant qui n'aurait pas ce besoin), sans changer le comportement
-- actuel de l'accueil.

drop function if exists public.accueil_classement(int, jsonb, numeric);

create or replace function public.accueil_classement(
  p_limit int default 20,
  p_affinites jsonb default '{}'::jsonb,
  p_facteur numeric default 0.6,
  p_offset int default 0
)
returns table (
  produit_id bigint,
  sous_categorie_id bigint,
  score_final numeric,
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
      cm.position as epingle_position,
      p.score_global * (1 + p_facteur *
        coalesce((p_affinites ->> (p.sous_categorie_id::text))::numeric, 0)) as score_final
    from produits p
    left join classement_manuel cm on cm.produit_id = p.id
    where p.statut_publication = 'publie'
      and coalesce(cm.exclu, false) = false
      and (
        p.photo is not null
        or (jsonb_typeof(p.photos) = 'array' and jsonb_array_length(p.photos) > 0)
      )
      and p.stock > 0
      and p.statut <> 'epuise'
      and p.delai in ('24h', '6j')
  ),
  mediane as (
    -- Exploration : « score GLOBAL au-dessus de la médiane » (§4.2), pas le final.
    select percentile_cont(0.5) within group (order by el.score_global) as m
    from eligibles el
  ),
  classes as (
    select
      e.*,
      row_number() over (
        partition by e.sous_categorie_id
        order by e.score_final desc, e.id
      ) as rang_sc
    from eligibles e
  )
  select
    c.id,
    c.sous_categorie_id,
    c.score_final,
    c.epingle_position,
    (c.vues_30j < 50 and c.score_global > coalesce((select m from mediane), 0)) as exploration_eligible
  from classes c
  where c.rang_sc <= 3 or c.epingle_position is not null
  order by c.score_final desc, c.id
  offset p_offset
  limit greatest(p_limit * 10, 200);
$$;

grant execute on function public.accueil_classement(int, jsonb, numeric, int) to anon, authenticated;

-- ============================================================================
-- Contrôles post-exécution
-- ============================================================================
-- select * from public.accueil_classement(20, '{}'::jsonb, 0.6, 0);
-- select * from public.accueil_classement(20, '{}'::jsonb, 0.6, 200); -- décalé, sans erreur
