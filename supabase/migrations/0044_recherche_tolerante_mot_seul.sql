-- SacAdo — La passe tolérante aux fautes ne s'applique qu'à un terme d'UN
-- seul mot (fix 0043 suite). À exécuter APRÈS 0043. Additive, rejouable.
--
-- Constat en vérification : "hp probook" renvoyait 2 résultats contre 1 pour
-- "hp" seul — violation directe de la règle n°1 (chaque mot tapé en plus doit
-- réduire le nombre de résultats, jamais l'augmenter,
-- TACHE_recherche_produits_v2.md §1). Cause : quand le ET strict sur "hp
-- probook" ne trouve aucun produit (le catalogue n'a que "HP", pas
-- "probook"), la passe tolérante se rabat sur la phrase ENTIÈRE et remonte
-- des faux positifs sans rapport (ex. un produit dont le nom partage
-- quelques trigrammes avec "hp probook" par coïncidence).
--
-- La correction de fautes n'a de sens que pour UN mot mal orthographié
-- ("arduno" -> "arduino"). Une requête à plusieurs mots qui ne matche rien en
-- ET strict doit rester vide : c'est un vrai miss, à journaliser comme tel
-- dans recherches_sans_resultat, pas à maquiller par un faux résultat flou.

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

  -- Tolérance aux fautes : seulement pour un terme d'UN mot (fix 0044). Sur
  -- plusieurs mots, un ET strict vide reste vide — cohérent avec la règle de
  -- décroissance stricte du nombre de résultats.
  if not found and array_length(v_mots, 1) = 1 then
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
-- select id, nom, score from rechercher_produits('arduno', 10);       -- 1+ (typo 1 mot)
-- select id, nom from rechercher_produits('hp', 10);                  -- doit être > 'hp probook'
-- select id, nom from rechercher_produits('hp probook', 10);          -- doit être vide ou <= 'hp'
-- select id, nom from rechercher_produits('hp probook 450', 10);      -- doit rester <= 'hp probook'
