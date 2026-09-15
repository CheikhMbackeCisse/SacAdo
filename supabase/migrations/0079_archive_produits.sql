-- SacAdo — Statut "archive" pour les produits (TACHE_nettoyage_carrousel_preferences.md §A.2)
-- À exécuter dans le SQL Editor Supabase. Additive + idempotente.
--
-- Un produit référencé par une commande ne se supprime jamais (casserait
-- l'historique, le calcul du bénéfice et le prix d'achat figé sur la ligne).
-- On le retire des affichages en le passant "archive" à la place. La policy
-- RLS "Lecture publique produits" (0013) n'autorise déjà que
-- `statut_publication = 'publie'` (tous les produits ont un vendeur_id
-- depuis 0036) : un produit archivé est automatiquement invisible côté
-- storefront, aucun autre changement de code n'est nécessaire.

alter table produits drop constraint if exists produits_statut_publication_check;
alter table produits add constraint produits_statut_publication_check
  check (statut_publication in ('en_attente', 'negociation', 'publie', 'refuse', 'archive'));

-- ============================================================================
-- Contrôle post-exécution
-- ============================================================================
-- select statut_publication, count(*) from produits group by statut_publication;
