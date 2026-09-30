-- SacAdo — PROMPT_CLIENT lot 1 : un produit épinglé (`classement_manuel.position`)
-- ne doit plus être bloqué par le stock. Jusqu'ici `accueil_classement` (0093)
-- exigeait `stock > 0` pour TOUT produit, y compris les épinglés — alors que le
-- quota par sous-catégorie (`rang_sc <= 3`), lui, était déjà contourné par un
-- épinglage. Incohérent : un produit épinglé à la main par le fondateur mais en
-- rupture disparaissait silencieusement de l'accueil malgré sa position.
--
-- Décision du fondateur (PROMPT_CLIENT.md lot 1, vérification du stock 0 sur
-- 1301/1303/1307 — en réalité 7 des 14 produits à épingler) : un épinglage
-- ignore désormais le stock, comme il ignore déjà le quota. `statut <> 'epuise'`
-- reste obligatoire dans tous les cas (un produit marqué épuisé par l'admin ne
-- doit jamais apparaître, même épinglé) : seule la condition sur le nombre de
-- pièces en stock est assouplie.
--
-- Idempotente. À exécuter dans le SQL Editor Supabase.

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
      and (p.stock > 0 or cm.position is not null)
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
-- select produit_id, epingle_position from public.accueil_classement(20, '{}'::jsonb, 0.6, 0)
-- where epingle_position is not null order by epingle_position;
-- -> doit inclure les produits épinglés à stock 0 (ex: 1715, 1636, 1301, 1290, 1303, 1307, 1199).
