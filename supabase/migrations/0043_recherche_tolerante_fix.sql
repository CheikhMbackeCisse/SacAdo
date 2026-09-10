-- SacAdo — Fix de la passe tolérante aux fautes de rechercher_produits (0041)
-- À exécuter dans le SQL Editor Supabase, APRÈS 0042.
-- Additive (create or replace), rejouable.
--
-- Constat en vérification post-migration : "arduno" renvoyait 0 résultat au
-- lieu de trouver « Kit Arduino débutant (starter kit) » par tolérance aux
-- fautes (TACHE_recherche_produits_v2.md §7). Cause : `similarity(a, b)`
-- compare les DEUX chaînes dans leur ensemble — un terme court comparé à un
-- nom de produit long dilue le score sous le seuil de 0.25, quelle que soit
-- la qualité du match. `word_similarity(mot, texte)` compare le mot à la
-- MEILLEURE sous-partie du texte : c'est l'outil pg_trgm fait pour ce cas.
--
-- Seule la passe tolérante change (le tri et le seuil). Le ET obligatoire de
-- la passe principale et le score de tri (100/60/40/10 + bonus) sont inchangés.

create or replace function rechercher_produits(
  terme text,
  limite integer default 24
)
returns table (
  id bigint,
  nom text,
  prix integer,
  photo text,
  statut text,
  type_resultat text,
  score real
)
language plpgsql
stable
as $$
#variable_conflict use_column
declare
  v_terme text;
  v_mots  text[];
begin
  v_terme := btrim(regexp_replace(
    public.unaccent_immutable(lower(coalesce(terme, ''))), '\s+', ' ', 'g'));

  if length(v_terme) < 2 then
    return;
  end if;

  v_mots := regexp_split_to_array(v_terme, ' ');

  return query
  with variantes as (
    select m.mot,
           array_agg(distinct coalesce(s2.terme, m.mot)) as liste
    from unnest(v_mots) as m(mot)
    left join synonymes s1 on s1.terme = m.mot
    left join synonymes s2 on s2.groupe = s1.groupe
    group by m.mot
  ),
  retenus as (
    select
      p.id, p.nom, p.prix, p.photo, p.statut, p.nom_normalise,
      not exists (
        select 1 from variantes v
        where not exists (
          select 1 from unnest(v.liste) as x(t)
          where p.nom_normalise like '%' || x.t || '%'
        )
      ) as tous_mots_dans_nom
    from produits p
    where not exists (
      select 1 from variantes v
      where not exists (
        select 1 from unnest(v.liste) as x(t)
        where p.recherche_texte like '%' || x.t || '%'
      )
    )
  )
  select
    r.id, r.nom, r.prix, r.photo, r.statut,
    case when r.tous_mots_dans_nom then 'nom' else 'categorie' end,
    (
        (case when r.nom_normalise like v_terme || '%' then 100 else 0 end)
      + (case when exists (
             select 1 from variantes v, unnest(v.liste) as x(t)
             where r.nom_normalise like x.t || '%'
                or r.nom_normalise like '% ' || x.t || '%'
           ) then 60 else 0 end)
      + (case when r.tous_mots_dans_nom then 40 else 10 end)
      + similarity(r.nom_normalise, v_terme) * 20
    )::real
  from retenus r
  order by 7 desc, (r.statut = 'dispo') desc, r.nom
  limit greatest(limite, 1);

  -- Passe tolérante aux fautes : word_similarity(mot court, texte long), pas
  -- similarity(). Le terme complet est comparé à sa meilleure correspondance
  -- DANS le nom, pas au nom entier.
  if not found then
    return query
    select
      p.id, p.nom, p.prix, p.photo, p.statut,
      'nom'::text,
      (word_similarity(v_terme, p.nom_normalise) * 20)::real
    from produits p
    where word_similarity(v_terme, p.nom_normalise) > 0.25
    order by 7 desc, p.nom
    limit greatest(limite, 1);
  end if;
end $$;

revoke execute on function rechercher_produits(text, integer) from public;
grant execute on function rechercher_produits(text, integer) to anon, authenticated;

-- ============================================================================
-- Contrôles post-exécution
-- ============================================================================
-- select id, nom, score from rechercher_produits('arduno', 10);   -- doit trouver le kit Arduino
-- select id, nom, score from rechercher_produits('cahiar', 10);   -- doit trouver un cahier
