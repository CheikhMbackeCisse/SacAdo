-- SacAdo — Recherche multi-niveaux (SOUS_SOUS_CATEGORIES.md §3)
-- À exécuter APRÈS 0030, dans le SQL Editor Supabase. Remplace les fonctions
-- de recherche (create or replace, donc rejouable sans risque).
--
-- Objectif : la recherche doit proposer les RAYONS à tous les niveaux
-- (catégorie, sous-catégorie, sous-sous-catégorie), pas seulement les produits.
-- Un terme large (« capteur ») doit d'abord aider à trouver le bon rayon, puis
-- lister les produits. L'indexation produit s'étend au nom de sa catégorie,
-- sa sous-catégorie et sa sous-sous-catégorie (un produit nommé "Résistance
-- 220Ω" doit remonter en tapant "capteur" s'il est rangé dans ce rayon... en
-- pratique surtout utile pour des noms de produits peu explicites).

-- ============================================================================
-- 1. rechercher_produits (page /recherche, résultats complets) : matche aussi
--    sur le nom de la catégorie / sous-catégorie / sous-sous-catégorie.
-- ============================================================================
create or replace function rechercher_produits(
  p_terme text,
  p_offset integer default 0,
  p_limit integer default 24
)
returns setof produits
language sql
stable
as $$
  select p.*
  from produits p
  join categories c on c.id = p.categorie_id
  left join sous_categories sc on sc.id = p.sous_categorie_id
  left join sous_sous_categories ssc on ssc.id = p.sous_sous_categorie_id
  where texte_proche(p_terme, p.nom)
     or texte_proche(p_terme, c.nom)
     or texte_proche(p_terme, sc.nom)
     or texte_proche(p_terme, ssc.nom)
  order by
    (p.nom ilike btrim(p_terme) || '%') desc,
    word_similarity(btrim(p_terme), p.nom) desc,
    p.nom asc
  offset greatest(p_offset, 0)
  limit least(greatest(p_limit, 1), 48);
$$;

revoke execute on function rechercher_produits(text, integer, integer) from public;
grant execute on function rechercher_produits(text, integer, integer) to anon, authenticated;

-- ============================================================================
-- 2. suggestions_recherche (autocomplétion) : + categories + sous_sous_categories.
--    Ordre côté client : catégories -> sous-catégories -> sous-sous-catégories
--    -> produits (les rayons aident à affiner avant la liste de produits).
-- ============================================================================
create or replace function suggestions_recherche(p_terme text)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'categories', coalesce((
      select jsonb_agg(row_to_json(s))
      from (
        select c.id, c.nom, c.slug
        from categories c
        where c.actif
          and length(btrim(p_terme)) > 1
          and (
            c.nom ilike '%' || btrim(p_terme) || '%'
            or word_similarity(btrim(p_terme), c.nom) > 0.5
          )
        order by
          (c.nom ilike btrim(p_terme) || '%') desc,
          word_similarity(btrim(p_terme), c.nom) desc,
          c.nom asc
        limit 3
      ) s
    ), '[]'::jsonb),
    'sous_categories', coalesce((
      select jsonb_agg(row_to_json(s))
      from (
        select sc.id, sc.nom, sc.slug,
               c.slug as categorie_slug, c.nom as categorie_nom
        from sous_categories sc
        join categories c on c.id = sc.categorie_id
        where length(btrim(p_terme)) > 1
          and (
            sc.nom ilike '%' || btrim(p_terme) || '%'
            or word_similarity(btrim(p_terme), sc.nom) > 0.5
          )
        order by
          (sc.nom ilike btrim(p_terme) || '%') desc,
          word_similarity(btrim(p_terme), sc.nom) desc,
          sc.nom asc
        limit 5
      ) s
    ), '[]'::jsonb),
    'sous_sous_categories', coalesce((
      select jsonb_agg(row_to_json(s))
      from (
        select ssc.id, ssc.nom, ssc.slug,
               sc.slug as sous_categorie_slug, sc.nom as sous_categorie_nom,
               c.slug as categorie_slug, c.nom as categorie_nom
        from sous_sous_categories ssc
        join sous_categories sc on sc.id = ssc.sous_categorie_id
        join categories c on c.id = sc.categorie_id
        where length(btrim(p_terme)) > 1
          and (
            ssc.nom ilike '%' || btrim(p_terme) || '%'
            or word_similarity(btrim(p_terme), ssc.nom) > 0.5
          )
        order by
          (ssc.nom ilike btrim(p_terme) || '%') desc,
          word_similarity(btrim(p_terme), ssc.nom) desc,
          ssc.nom asc
        limit 5
      ) s
    ), '[]'::jsonb),
    'produits', coalesce((
      select jsonb_agg(row_to_json(s))
      from (
        select p.id, p.nom, p.photo, p.prix, p.statut
        from produits p
        join categories c on c.id = p.categorie_id
        left join sous_categories sc on sc.id = p.sous_categorie_id
        left join sous_sous_categories ssc on ssc.id = p.sous_sous_categorie_id
        where texte_proche(p_terme, p.nom)
           or texte_proche(p_terme, c.nom)
           or texte_proche(p_terme, sc.nom)
           or texte_proche(p_terme, ssc.nom)
        order by
          (p.nom ilike btrim(p_terme) || '%') desc,
          word_similarity(btrim(p_terme), p.nom) desc,
          p.nom asc
        limit 6
      ) s
    ), '[]'::jsonb)
  );
$$;

revoke execute on function suggestions_recherche(text) from public;
grant execute on function suggestions_recherche(text) to anon, authenticated;
