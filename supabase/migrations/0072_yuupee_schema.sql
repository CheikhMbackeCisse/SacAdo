-- SacAdo — Yuupee : fournisseur + schéma (TACHE_yuupee_integration_complete.md
-- + TACHE_kits_impression_classement.md). À exécuter APRÈS 0071, dans le SQL
-- Editor Supabase. Idempotent : peut être relancé sans erreur.
--
-- Ce que fait cette migration :
--   1. `produits` : attributs impression/informatique (technologie,
--      couleur_impression, compatibilite) — TACHE_yuupee_integration_complete.md §4.
--   2. `produits.coefficient_visibilite` : déclassement générique dans le
--      classement (pas réservé à Yuupee) — §6 / TACHE_kits_impression_classement.md
--      Chantier C. Le branchement dans l'algorithme de score est un chantier
--      séparé : cette migration ne fait que poser la colonne, valeur neutre
--      1.00 partout tant que rien ne la lit.
--   3. `produits.prix_a_verifier` : import autorisé mais publication bloquée
--      quand le prix tombe sous le plancher de sa sous-catégorie — §5.
--      Alimente le futur écran admin « Prix à vérifier ».
--   4. `compatibilite` entre dans l'index de recherche (recherche_texte) —
--      §4 : « chercher un modèle d'imprimante remonte les consommables
--      compatibles ». Aucune colonne `vendeurs` à ajouter : grille_remise /
--      grille_majoration existent déjà depuis 0070 et suffisent (Yuupee
--      utilisera grille_majoration seule, grille_remise restera null tant
--      qu'aucune remise n'est négociée).

-- ============================================================================
-- 1. PRODUITS : attributs impression / informatique
-- ============================================================================
alter table produits add column if not exists technologie text;          -- 'jet d encre' | 'laser'
alter table produits add column if not exists couleur_impression text;   -- 'couleur' | 'monochrome'
alter table produits add column if not exists compatibilite text;        -- modèles d'imprimante compatibles, texte libre

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'produits_technologie_check'
  ) then
    alter table produits add constraint produits_technologie_check
      check (technologie is null or technologie in ('jet d encre', 'laser'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'produits_couleur_impression_check'
  ) then
    alter table produits add constraint produits_couleur_impression_check
      check (couleur_impression is null or couleur_impression in ('couleur', 'monochrome'));
  end if;
end $$;

-- ============================================================================
-- 2. PRODUITS : déclassement générique dans le classement
-- ============================================================================
alter table produits add column if not exists coefficient_visibilite numeric(3,2) not null default 1.00;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'produits_coefficient_visibilite_check'
  ) then
    alter table produits add constraint produits_coefficient_visibilite_check
      check (coefficient_visibilite > 0);
  end if;
end $$;

-- ============================================================================
-- 3. PRODUITS : prix à vérifier (import sous le plancher de la sous-catégorie)
-- ============================================================================
alter table produits add column if not exists prix_a_verifier boolean not null default false;

-- ============================================================================
-- 4. RECHERCHE : compatibilite entre dans recherche_texte
-- ============================================================================
-- Remplace la fonction posée par 0041 (même trigger, même signature) : on
-- ajoute compatibilite à la concaténation, rien d'autre ne change.
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

  new.nom_normalise := public.unaccent_immutable(lower(coalesce(new.nom, '')));

  new.recherche_texte := public.unaccent_immutable(lower(
      coalesce(new.nom, '')            || ' ' ||
      coalesce(new.description, '')     || ' ' ||
      coalesce(v_cat, '')               || ' ' ||
      coalesce(v_sous, '')              || ' ' ||
      coalesce(v_ssous, '')             || ' ' ||
      coalesce(new.mots_cles, '')       || ' ' ||
      coalesce(new.compatibilite, '')
  ));
  return new;
end $$;

-- ============================================================================
-- Contrôles post-exécution (à lancer après la migration)
-- ============================================================================
-- select column_name from information_schema.columns
--   where table_name = 'produits'
--     and column_name in ('technologie','couleur_impression','compatibilite',
--                          'coefficient_visibilite','prix_a_verifier');
-- select coefficient_visibilite, count(*) from produits group by 1;  -- tout à 1.00
