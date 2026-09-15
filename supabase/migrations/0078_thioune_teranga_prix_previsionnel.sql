-- SacAdo — prix d'achat prévisionnel (TACHE_thioune_integration.md §4)
-- À exécuter après 0077, dans le SQL Editor Supabase. Idempotent.
--
-- Marque un produit dont le prix d'achat n'est pas confirmé par le
-- fournisseur : la vente est fixée sur une estimation (médiane de marché),
-- l'achat réel sera connu à la première commande. Purement déclaratif ici —
-- cette migration pose seulement la colonne pour que l'import Thioune
-- Teranga puisse déjà la marquer. Le workflow de confirmation (bandeau sur
-- la fiche produit admin, saisie du prix réel à la première commande,
-- garde-fou anti-vente-à-perte) est un lot séparé, pas câblé ici.

alter table produits
  add column if not exists prix_achat_previsionnel boolean not null default false;

comment on column produits.prix_achat_previsionnel is
  'Prix d''achat estimé (médiane marché), pas encore confirmé par le fournisseur. Voir TACHE_thioune_integration.md §4.';

-- ============================================================================
-- Contrôles post-exécution
-- ============================================================================
-- select column_name, data_type, is_nullable, column_default
--   from information_schema.columns
--  where table_name = 'produits' and column_name = 'prix_achat_previsionnel';
