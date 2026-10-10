-- SacAdo — TACHE_commandes_fournisseurs_promo_express.md Lot 4a : promo
-- "express au prix de la livraison normale" les jours d'achat fournisseur.
-- À exécuter après 0118. Idempotente.
--
-- Réglage dans `parametres` (clé 'promo_express', valeur JSON — lib/promo-express.ts) :
-- {"actif": bool, "joursRecurrents": [0-6], "datesPonctuelles": ["YYYY-MM-DD"], "heureLimite": "HH:MM"}.
-- Pas de ligne par défaut : getConfigPromoExpress() applique son propre repli
-- (actif: false) tant que l'admin n'a rien réglé.
--
-- `commandes.promo_express` : figé à la création (lib/checkout/actions.ts),
-- true si le tarif express facturé a été aligné sur le tarif "à date donnée"
-- par la promo. `frais_livraison` porte déjà le montant réellement appliqué
-- (aucune nouvelle colonne de montant nécessaire).

alter table commandes add column if not exists promo_express boolean not null default false;

-- ============================================================================
-- Contrôle post-exécution
-- ============================================================================
-- select column_name from information_schema.columns where table_name = 'commandes'
--   and column_name = 'promo_express';
-- -> doit lister la colonne.
