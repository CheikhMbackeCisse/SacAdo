-- SacAdo — Utilitaire de vérification "ce nom de fichier apparaît-il quelque
-- part en base ?" (TACHE_nettoyage_carrousel_preferences.md §A.3, retour du
-- fondateur : comparer des URLs exactes sur 2 colonnes ne suffit pas — il faut
-- chercher le nom de fichier dans TOUTES les colonnes texte de la base).
-- À coller une fois dans le SQL Editor Supabase. Fonction réutilisable, pas une
-- migration de schéma — peut rester en base sans effet de bord.
--
-- v2 : la v1 ignorait les colonnes tableau (`text[]`) — corrigé (inutile en
-- pratique ici, voir v3).
-- v3 : `produits.photos` n'est PAS un `text[]`, c'est un `jsonb` (tableau
-- d'URLs stocké en JSON, migration 0019) — `data_type = 'ARRAY'` ne le
-- capturait toujours pas, donc les ~360 photos de galerie continuaient à
-- ressortir comme orphelines à tort. Ajout d'un passage sur les colonnes
-- json/jsonb, comparées en texte brut (::text) : simple et sûr, capture toute
-- occurrence du motif où qu'elle soit dans le JSON, sans supposer sa forme.

create or replace function texte_present_partout(p_motif text)
returns boolean
language plpgsql
as $$
declare
  r record;
  trouve boolean;
begin
  -- Colonnes texte simples.
  for r in
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
      and data_type in ('text', 'character varying')
  loop
    execute format(
      'select exists (select 1 from %I where %I ilike %L)',
      r.table_name, r.column_name, '%' || p_motif || '%'
    ) into trouve;
    if trouve then
      return true;
    end if;
  end loop;

  -- Colonnes tableau de texte (ex. produits.photos text[]). udt_name donne le
  -- nom du type élément pour un ARRAY : '_text' pour text[], '_varchar' pour
  -- character varying[].
  for r in
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
      and data_type = 'ARRAY'
      and udt_name in ('_text', '_varchar')
  loop
    execute format(
      'select exists (select 1 from %I t, unnest(t.%I) as elem where elem ilike %L)',
      r.table_name, r.column_name, '%' || p_motif || '%'
    ) into trouve;
    if trouve then
      return true;
    end if;
  end loop;

  -- Colonnes json/jsonb (ex. produits.photos, un tableau d'URLs en jsonb).
  -- Comparaison en texte brut : peu importe la forme exacte du JSON, toute
  -- occurrence du motif quelque part dedans est détectée.
  for r in
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
      and data_type in ('json', 'jsonb')
  loop
    execute format(
      'select exists (select 1 from %I where %I::text ilike %L)',
      r.table_name, r.column_name, '%' || p_motif || '%'
    ) into trouve;
    if trouve then
      return true;
    end if;
  end loop;

  return false;
end;
$$;

-- ============================================================================
-- Contrôle
-- ============================================================================
-- select texte_present_partout('nom_de_fichier.webp');
-- -- doit renvoyer true pour un fichier référencé uniquement via produits.photos :
-- select texte_present_partout('246e9ac1-9d0c-4a0e-9907-d3664e62303e.webp');
