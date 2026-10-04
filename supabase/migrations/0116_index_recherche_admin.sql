-- PROMPT_ADMIN_KITS_PRODUITS.md, lot 5 : la recherche produits (admin ET
-- client, via recherche_texte/rechercher_produits) n'avait AUCUN index sur
-- `recherche_texte` lui-même — chaque `ilike '%mot%'` fait un balayage
-- complet de la table produits. Avec 1731+ lignes et plusieurs mots par
-- requête (tapés en direct dans le sélecteur de l'éditeur de kit), c'est la
-- cause la plus probable de lenteur perçue. `nom` avait déjà son index trgm
-- (migration 0009) ; `recherche_texte` et `marque` (nouveau champ de
-- recherche admin, lot 1) ne l'avaient pas. Ajoute aussi un index sur
-- `created_at`, utilisé par le tri "Dernière modification" de /admin/produits.
-- Idempotente (if not exists). À exécuter dans le SQL Editor Supabase.

create extension if not exists pg_trgm;

create index if not exists idx_produits_recherche_texte_trgm
  on produits using gin (recherche_texte gin_trgm_ops);

create index if not exists idx_produits_marque_trgm
  on produits using gin (marque gin_trgm_ops);

create index if not exists idx_produits_created_at
  on produits (created_at desc);
