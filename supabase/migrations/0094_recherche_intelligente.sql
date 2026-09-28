-- SacAdo — CORRECTIONS_V11 lot 4 : recherche intelligente multi-mots.
-- À exécuter APRÈS 0093, dans le SQL Editor Supabase. Idempotente (create or
-- replace / on conflict do nothing), sauf les deletes de correction de
-- groupes (§3 plus bas), qui ne s'appliquent qu'une fois de toute façon.
--
-- Diagnostic (fait avant d'écrire cette migration, contre la prod réelle via
-- un script de lecture seule) : le ET obligatoire multi-mots et les synonymes
-- fonctionnent déjà correctement depuis un chantier postérieur à la rédaction
-- de CORRECTIONS_V11.md — "mathematiques 3eme" et "maths troisieme" trouvent
-- déjà tous les deux "MATHEMATIQUES TROISIEME". Le vrai problème restant,
-- vérifié : le SCORE de tri mélange le classement par paliers (nom / catégorie)
-- avec une similarité de texte brut calculée sur la phrase TAPÉE telle quelle
-- (`nom_normalise like v_terme || '%'` + `similarity()`) — deux requêtes
-- synonymes l'une de l'autre ("mathematiques 3eme" vs "Mathématiques
-- Troisième") obtiennent donc le MÊME ENSEMBLE de résultats mais dans un
-- ORDRE différent, ce qui viole le critère de réussite du lot 4. Reproduit et
-- confirmé aussi : "1ʳᵉ"/"Tlᵉ" (exposants Unicode, pas des accents) ne
-- matchent jamais "1re"/"tle" car `unaccent` ne les touche pas ; "C.M.2" ne
-- matche jamais "cm2" (le split par espace casse "CM 2" en deux mots séparés
-- "cm" et "2") ; le groupe 19 mélange équerres et rapporteurs ; le groupe 8
-- mélange feutres de coloriage et marqueurs de tableau.

-- ============================================================================
-- 1. Normalisation commune (trigger + RPC) — remplace l'usage direct de
--    unaccent_immutable(lower(...)) par une étape supplémentaire commune.
--    unaccent_immutable lui-même n'est PAS modifié : d'autres fonctionnalités
--    (localites, migration 0053) s'appuient sur son comportement actuel.
-- ============================================================================
create or replace function public.normaliser_recherche(texte text)
returns text
language sql
immutable
parallel safe
as $$
  select btrim(
    regexp_replace(
      regexp_replace(
        replace(
          replace(
            replace(
              public.unaccent_immutable(lower(coalesce(texte, ''))),
              'ᵉ', 'e'
            ),
            'ʳ', 'r'
          ),
          '.', ''
        ),
        '\y(ci|cp|ce|cm)\s+([0-9])', '\1\2', 'g'
      ),
      '\s+', ' ', 'g'
    )
  )
$$;

-- ============================================================================
-- 2. Trigger d'index : utilise la normalisation commune, puis réindexation.
-- ============================================================================
create or replace function public.maj_index_recherche()
returns trigger
language plpgsql
as $$
declare
  v_cat   text;
  v_sous  text;
  v_ssous text;
begin
  select c.nom  into v_cat   from categories c            where c.id = new.categorie_id;
  select s.nom  into v_sous  from sous_categories s        where s.id = new.sous_categorie_id;
  select ss.nom into v_ssous from sous_sous_categories ss  where ss.id = new.sous_sous_categorie_id;

  new.nom_normalise := public.normaliser_recherche(new.nom);

  new.recherche_texte := public.normaliser_recherche(
      coalesce(new.nom, '')         || ' ' ||
      coalesce(new.description, '')  || ' ' ||
      coalesce(v_cat, '')           || ' ' ||
      coalesce(v_sous, '')          || ' ' ||
      coalesce(v_ssous, '')         || ' ' ||
      coalesce(new.mots_cles, '')
  );
  return new;
end $$;

-- Réindexe tous les produits avec la nouvelle normalisation (superscripts,
-- points, "CM 2" -> "cm2"). Nécessaire : sans ça, les lignes déjà en base
-- gardent leur ancien nom_normalise/recherche_texte.
update produits set nom = nom;

-- ============================================================================
-- 3. Corrections de groupes de synonymes (synonymes_a_ajouter.xlsx, onglet
--    "Groupes à revoir"). Le groupe 102 reste tel quel (instruction explicite).
-- ============================================================================

-- Groupe 19 (equerre, rapporteur) : une équerre n'est pas un rapporteur.
-- "equerre" rejoint le groupe 18 (matériel de géométrie) ; "rapporteur" reste
-- seul dans le groupe 19.
delete from synonymes where groupe = 19 and terme = 'equerre';

-- Groupe 141 (conjugaison, francais, grammaire, lecture) : trop large
-- ("lecture cp" ramenait tous les livres de français du CP). Ces trois mots
-- deviennent chacun leur propre groupe (aucune expansion : juste eux-mêmes),
-- "francais" reste seul avec "french" en plus.
delete from synonymes where groupe = 141 and terme in ('conjugaison', 'grammaire', 'lecture');

-- Groupe 8 (marqueur, feutre, velleda, marqueur tableau) : mélange feutres de
-- coloriage et marqueurs de tableau. "feutre" part dans un nouveau groupe.
delete from synonymes where groupe = 8 and terme = 'feutre';

-- ============================================================================
-- 4. Synonymes manquants (synonymes_a_ajouter.xlsx, onglet "À ajouter").
--    Les entrées de ponctuation pure (C.I., C.P., C.E.1...) sont devenues
--    inutiles grâce à la normalisation commune (§1) : "C.I" -> "ci", déjà
--    dans le groupe 120. Non réinsérées pour ne pas dupliquer pour rien.
-- ============================================================================
insert into synonymes (groupe, terme) values
  -- Nouveaux groupes (suite du groupe max existant, 162).
  (163, 'maternelle'), (163, 'prescolaire'), (163, 'pre-scolaire'),
  (164, 'petite section'), (164, 'ps'),
  (165, 'moyenne section'), (165, 'ms'),
  (166, 'grande section'), (166, 'gs'),
  (167, 'primaire'), (167, 'elementaire'),
  (168, 'cfee'), (168, 'entree en sixieme'),
  (169, 'edd'), (169, 'developpement durable'),
  (170, 'roman'), (170, 'oeuvre'), (170, 'oeuvres'), (170, 'oeuvre au programme'),
  (171, 'manuel'), (171, 'manuels'), (171, 'livre'), (171, 'livres'),
  (172, 'cahier d activites'), (172, 'cahier d exercices'),
  (173, 'travaux pratiques'), (173, 'tp'), (173, 'cahier tp'), (173, 'cahier de travaux pratiques'),
  (174, 'brouillon'), (174, 'cahier de brouillon'),
  (175, 'dessin'), (175, 'cahier de dessin'), (175, 'arts plastiques'),
  (176, '200 pages'), (176, '192 pages'), (176, '200p'), (176, '192p'),
  (177, '100 pages'), (177, '96 pages'), (177, '100p'), (177, '96p'),
  -- Scission du groupe 8 (§3) : feutres de coloriage, séparés des marqueurs.
  (178, 'feutre'), (178, 'feutres'), (178, 'feutres de coloriage'),
  -- Scission du groupe 141 (§3) : plus d'expansion, chacun isolé.
  (179, 'grammaire'),
  (180, 'conjugaison'),
  (181, 'lecture'),

  -- Ajouts à des groupes existants.
  (3, 'crayons de couleur'), (3, 'crayon couleur'),
  (126, '6em'), (126, '6ieme'),
  (127, '5em'), (127, '5ieme'),
  (128, '4em'), (128, '4ieme'),
  (102, '3em'), (102, '3ieme'),
  (130, '1er'),
  (103, 'tale'), (103, 'tles'),
  (140, 'mathematique'),
  (143, 'physique-chimie'),
  (144, 'histoire-geographie'), (144, 'histo'), (144, 'geo'),
  (146, 'spanish'), (146, 'espanol'),
  (149, 'instruction civique'),
  (27, 'dico'),
  (100, 'sujets'), (100, 'epreuves'), (100, 'corriges'),
  (13, 'copies doubles'),
  (10, 'couvre-cahier'),
  (11, 'pochette'), (11, 'sous-chemise'),
  (1, 'stylo a bille'),
  (5, 'tailleur'),
  (6, 'tipp-ex'), (6, 'souris correctrice'),
  (18, 'kit de tracage'), (18, 'trousse de geometrie'), (18, 'geometrie'), (18, 'equerre'),
  (22, 'sac'),
  (29, 'aquarelle'),
  (141, 'french'),
  -- Trouvé en diagnostic (pas dans le tableur) : "svt" ne trouvait pas
  -- "Science de la vie et de la terre" (singulier) — seul le pluriel
  -- "sciences de la vie et de la terre" était enregistré dans le groupe 142.
  (142, 'science de la vie et de la terre')
on conflict (terme) do nothing;

-- ============================================================================
-- 5. rechercher_produits() : classement par paliers au lieu d'une similarité
--    de texte brut sur la phrase tapée (cause du désordre, voir diagnostic).
--
--    Palier 3 (nom)      : tous les mots (littéraux OU synonymes) dans le nom.
--    Palier 2 (categorie): tous les mots dans le texte élargi (nom + description
--                          + catégorie/sous-catégorie/sous-sous-catégorie).
--    Palier 1 (tolérant) : comme le palier 2, mais un mot sans correspondance
--                          exacte peut être couvert par similarité (fautes de
--                          frappe) — mot par mot, plus seulement pour une
--                          requête d'un seul mot (ancien comportement 0044).
--    À palier égal : produit en stock (statut = 'dispo') avant épuisé, puis
--    score_global (signal déjà utilisé par le classement de l'accueil, stable
--    et indépendant de la requête — permet par ex. à la Casio fx-991ES de
--    sortir en tête d'un groupe de calculatrices à égalité de palier), puis le
--    nom en dernier recours. Aucune de ces clés ne dépend de la façon dont la
--    requête a été tapée : deux formulations synonymes ("mathematiques 3eme"
--    vs "Mathématiques Troisième") donnent donc exactement le même ordre.
--
--    Note de conception : le tableur distingue un 4e palier, "tel quel" (sans
--    synonyme) avant "via synonyme". Vérifié : cette distinction dépend de la
--    forme EXACTE tapée (un produit nommé "3ème" passe "tel quel" pour la
--    requête "maths 3e" mais "via synonyme" pour "Mathématiques Troisième", et
--    inversement pour un produit nommé "Troisième") — elle reproduirait donc
--    le désordre que ce lot doit justement supprimer. Non implémentée pour
--    cette raison ; à revoir avec le fondateur si ce palier est jugé
--    indispensable malgré l'incompatibilité avec le critère de réussite.
-- ============================================================================
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

  return query
  with mots_base as (
    -- Singulier probable : un mot de plus de 3 lettres finissant par "s" est
    -- aussi cherché sans son "s" ("cahiers" retrouve un produit nommé au
    -- singulier — l'inverse marche déjà tout seul par inclusion de
    -- sous-chaîne : "cahier" est déjà contenu dans "cahiers").
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
      -- Palier "nom" : chaque mot (littéral ou synonyme) est dans le nom.
      not exists (
        select 1 from variantes v
        where not exists (
          select 1 from unnest(v.liste) as x(t)
          where p.nom_normalise like '%' || x || '%'
        )
      ) as rang_nom,
      -- Palier "catégorie" : chaque mot est dans le texte élargi.
      not exists (
        select 1 from variantes v
        where not exists (
          select 1 from unnest(v.liste) as x(t)
          where p.recherche_texte like '%' || x || '%'
        )
      ) as rang_categorie,
      -- Palier "tolérant" : comme ci-dessus, mais un mot sans correspondance
      -- exacte peut être couvert par similarité (mot par mot).
      not exists (
        select 1 from variantes v
        where not exists (
          select 1 from unnest(v.liste) as x(t)
          where p.recherche_texte like '%' || x || '%'
        )
        and word_similarity(v.mot, p.recherche_texte) <= 0.25
      ) as rang_tolerant
    from produits p
  ),
  classes as (
    select c.*,
           case
             when c.rang_nom then 3
             when c.rang_categorie then 2
             when c.rang_tolerant then 1
             else 0
           end as rang
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
end $$;

revoke execute on function rechercher_produits(text, integer) from public;
grant execute on function rechercher_produits(text, integer) to anon, authenticated;

-- ============================================================================
-- Contrôles post-exécution
-- ============================================================================
-- Les trois doivent donner EXACTEMENT le même résultat, dans le même ordre :
-- select nom from rechercher_produits('mathematiques 3eme', 10);
-- select nom from rechercher_produits('Mathématiques Troisième', 10);
-- select nom from rechercher_produits('MATHS 3E', 10);
-- select nom from rechercher_produits('mathematiqes 3em', 10);   -- tolérant, doit retrouver la même liste
-- select nom from rechercher_produits('svt 1ere', 10);            -- doit trouver la SVT Première
-- select nom from rechercher_produits('lc cm2', 10);              -- doit aussi trouver "Langue et communication C.M.2"
-- select nom from rechercher_produits('rapporteur', 10);          -- rapporteurs d'abord, plus d'équerre
-- select nom, score from rechercher_produits('calculette', 10);   -- Casio fx-991ES en tête (score_global)
