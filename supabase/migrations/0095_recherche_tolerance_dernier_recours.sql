-- SacAdo — Corrige une régression de 0094 (CORRECTIONS_V11 lot 4).
-- À exécuter APRÈS 0094, dans le SQL Editor Supabase. Idempotente.
--
-- Constat en vérification post-0094 (script scripts/verifier-recherche-lot4.mjs,
-- contre la prod réelle) : la passe tolérante aux fautes de frappe était
-- devenue systématique (évaluée à CHAQUE recherche, pas seulement en dernier
-- recours), avec un seuil de similarité permissif (0.25) appliqué sur
-- `recherche_texte` — un champ souvent long (nom + description + catégories).
-- Sur un texte long, `word_similarity` trouve presque toujours UNE sous-partie
-- qui dépasse 0.25 par pur hasard : "rapporteur" ramenait des ordinateurs HP,
-- "physique chimie 3e" des chargeurs, "cahier 200 pages" une calculatrice —
-- alors que de vrais résultats exacts existaient déjà. Seul le palier et le
-- score changent : la normalisation, les synonymes et le trigger de 0094
-- restent corrects et ne sont pas retouchés ici.
--
-- Fix : comme avant 0094 (migrations 0041/0043/0044), la tolérance ne
-- s'applique qu'en DERNIER RECOURS, quand la recherche stricte (palier nom
-- ou catégorie) ne trouve RIEN — mais désormais mot par mot (chaque mot peut
-- être couvert par une correspondance exacte OU par similarité), plus
-- seulement pour une requête d'un seul mot.

drop function if exists rechercher_produits(text, integer);

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
  v_terme := public.normaliser_recherche(terme);

  if length(v_terme) < 2 then
    return;
  end if;

  v_mots := regexp_split_to_array(v_terme, ' ');

  -- 1. Passe stricte : palier "nom" puis "catégorie", tous deux exacts ou via
  --    synonyme (voir 0094). Aucune similarité de texte ici.
  return query
  with mots_base as (
    select m.mot,
           case when length(m.mot) > 3 and right(m.mot, 1) = 's'
                then left(m.mot, length(m.mot) - 1)
                else m.mot
           end as mot_base
    from unnest(v_mots) as m(mot)
  ),
  variantes as (
    select mb.mot,
           array_agg(distinct coalesce(s2.terme, mb.mot_base)) as liste
    from mots_base mb
    left join synonymes s1 on s1.terme = mb.mot or s1.terme = mb.mot_base
    left join synonymes s2 on s2.groupe = s1.groupe
    group by mb.mot, mb.mot_base
  ),
  candidats as (
    select
      p.id, p.nom, p.prix, p.photo, p.statut, p.score_global,
      not exists (
        select 1 from variantes v
        where not exists (
          select 1 from unnest(v.liste) as x(t)
          where p.nom_normalise like '%' || x || '%'
        )
      ) as rang_nom,
      not exists (
        select 1 from variantes v
        where not exists (
          select 1 from unnest(v.liste) as x(t)
          where p.recherche_texte like '%' || x || '%'
        )
      ) as rang_categorie
    from produits p
  ),
  classes as (
    select c.*,
           case when c.rang_nom then 2 when c.rang_categorie then 1 else 0 end as rang
    from candidats c
  )
  select
    c.id, c.nom, c.prix, c.photo, c.statut,
    case when c.rang_nom then 'nom' else 'categorie' end,
    (c.rang * 10 + coalesce(c.score_global, 0))::real
  from classes c
  where c.rang > 0
  order by c.rang desc, (c.statut = 'dispo') desc, c.score_global desc nulls last, c.nom
  limit greatest(limite, 1);

  -- 2. Rien trouvé -> SEULEMENT ALORS, passe tolérante mot par mot : chaque
  --    mot doit avoir une correspondance exacte/synonyme OU dépasser le seuil
  --    de similarité (fautes de frappe, "mathematiqes 3em").
  if not found then
    return query
    with mots_base as (
      select m.mot,
             case when length(m.mot) > 3 and right(m.mot, 1) = 's'
                  then left(m.mot, length(m.mot) - 1)
                  else m.mot
             end as mot_base
      from unnest(v_mots) as m(mot)
    ),
    variantes as (
      select mb.mot,
             array_agg(distinct coalesce(s2.terme, mb.mot_base)) as liste
      from mots_base mb
      left join synonymes s1 on s1.terme = mb.mot or s1.terme = mb.mot_base
      left join synonymes s2 on s2.groupe = s1.groupe
      group by mb.mot, mb.mot_base
    )
    select
      p.id, p.nom, p.prix, p.photo, p.statut,
      'nom'::text,
      (10 + coalesce(p.score_global, 0))::real
    from produits p
    where not exists (
      select 1 from variantes v
      where not exists (
        select 1 from unnest(v.liste) as x(t)
        where p.recherche_texte like '%' || x || '%'
      )
      and word_similarity(v.mot, p.recherche_texte) <= 0.25
    )
    order by (p.statut = 'dispo') desc, p.score_global desc nulls last, p.nom
    limit greatest(limite, 1);
  end if;
end $$;

revoke execute on function rechercher_produits(text, integer) from public;
grant execute on function rechercher_produits(text, integer) to anon, authenticated;

-- ============================================================================
-- Contrôles post-exécution
-- ============================================================================
-- select nom, score from rechercher_produits('rapporteur', 10);        -- 2 rapporteurs, plus de HP
-- select nom from rechercher_produits('physique chimie 3e', 10);        -- plus de chargeurs
-- select nom from rechercher_produits('cahier 200 pages', 10);          -- plus de calculatrice
-- select nom from rechercher_produits('mathematiqes 3em', 10);          -- doit toujours retrouver les mêmes 5 (tolérant, aucun résultat strict)
-- select nom from rechercher_produits('mathematiques 3eme', 10);
-- select nom from rechercher_produits('Mathématiques Troisième', 10);
-- select nom from rechercher_produits('MATHS 3E', 10);                  -- les trois identiques
