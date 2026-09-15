-- SacAdo — Accueil scopé à la catégorie Fournitures d'école
-- (TACHE_correction_accueil.md). La section produits de l'accueil ne doit
-- montrer que la catégorie "fournitures-ecole", classée par l'algorithme
-- habituel. Ajoute un paramètre optionnel p_categorie_id à
-- accueil_classement (dernière définition : 0068_livres_korka.sql) — signature
-- rétrocompatible, seul appelant existant : lib/accueil.ts.
-- À exécuter dans le SQL Editor Supabase, après 0080.
--
-- `create or replace` ne remplace une fonction que si la liste de paramètres
-- est identique : avec un paramètre en plus, Postgres créerait une 2e
-- fonction surchargée au lieu de remplacer l'ancienne. On supprime donc
-- explicitement l'ancienne signature à 3 paramètres avant de recréer.
drop function if exists public.accueil_classement(int, jsonb, numeric);

create or replace function public.accueil_classement(
  p_limit int default 20,
  p_affinites jsonb default '{}'::jsonb,
  p_facteur numeric default 0.6,
  p_categorie_id bigint default null
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
        coalesce((p_affinites ->> (p.sous_categorie_id::text))::numeric, 0)) *
        case when p.edition_statut = 'ancienne' then 0.5 else 1 end as score_final
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
      and (p_categorie_id is null or p.categorie_id = p_categorie_id)
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
  limit greatest(p_limit * 10, 200);
$$;

grant execute on function public.accueil_classement(int, jsonb, numeric, bigint) to anon, authenticated;
