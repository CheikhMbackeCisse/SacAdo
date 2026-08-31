-- SacAdo — Corrections V4 : recherche tolérante aux fautes + suggestions live
-- À exécuter après 0009 (qui a activé pg_trgm et créé les index trigram).
-- Additive. Idempotente (create or replace).
--
-- Trois fonctions, appelables avec la clé anon (le catalogue est public) :
--  - texte_proche(terme, texte) : le prédicat de correspondance floue, partagé.
--  - rechercher_produits : page /recherche, résultats paginés.
--  - suggestions_recherche : liste courte pendant la frappe (produits + sous-cat).
--
-- Tolérance aux fautes = 3 filets successifs :
--   1. sous-chaîne exacte (ilike)          -> "cahi" trouve "Cahier"
--   2. similarité trigrammes (word_similarity) -> "arduno" trouve "Arduino"
--   3. distance de Levenshtein par mot     -> "stilo" trouve "Stylo",
--                                              "chaier" trouve "Cahier"

create extension if not exists fuzzystrmatch;

-- ============================================================================
-- 1. Prédicat de correspondance floue (partagé)
-- ============================================================================
create or replace function texte_proche(p_terme text, p_texte text)
returns boolean
language sql
immutable
as $$
  select case
    when length(btrim(p_terme)) = 0 then false
    when p_texte ilike '%' || btrim(p_terme) || '%' then true
    when word_similarity(btrim(p_terme), p_texte) > 0.3 then true
    when length(btrim(p_terme)) >= 4 and exists (
      select 1
      from regexp_split_to_table(lower(p_texte), '[^[:alnum:]]+') as w(tok)
      where w.tok <> ''
        and abs(length(w.tok) - length(btrim(p_terme))) <= 1
        and levenshtein(lower(btrim(p_terme)), w.tok) <= 2
    ) then true
    else false
  end;
$$;

-- ============================================================================
-- 2. Résultats de recherche paginés (remplace le ilike simple de queries.ts)
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
  where texte_proche(p_terme, p.nom)
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
-- 3. Suggestions live (produits + sous-catégories) pendant la frappe
-- ============================================================================
create or replace function suggestions_recherche(p_terme text)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'produits', coalesce((
      select jsonb_agg(row_to_json(s))
      from (
        select p.id, p.nom, p.photo, p.prix, p.statut
        from produits p
        where texte_proche(p_terme, p.nom)
        order by
          (p.nom ilike btrim(p_terme) || '%') desc,
          word_similarity(btrim(p_terme), p.nom) desc,
          p.nom asc
        limit 6
      ) s
    ), '[]'::jsonb),
    'sous_categories', coalesce((
      select jsonb_agg(row_to_json(s))
      from (
        -- Les sous-catégories sont des raccourcis de navigation : on n'affiche
        -- que des correspondances sûres (sous-chaîne ou forte similarité), pas
        -- le filet Levenshtein plus permissif utilisé pour les produits.
        select sc.id, sc.nom, sc.slug, sc.categorie_slug
        from sous_categories sc
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
    ), '[]'::jsonb)
  );
$$;

revoke execute on function suggestions_recherche(text) from public;
grant execute on function suggestions_recherche(text) to anon, authenticated;
