-- SacAdo — Ndayane Sport : guide des tailles + point de retrait fournisseur
-- (TACHE_ndayane_sport_et_variantes.md)
-- À exécuter dans le SQL Editor Supabase, après 0068. Idempotent (add column
-- if not exists / insert ... where not exists) : peut être relancé sans erreur.
--
-- Écarts assumés par rapport au document de tâche (voir chat) :
--   - Partie 0 (fournisseur_id NOT NULL sur produits) : déjà couvert autrement
--     depuis la migration 0036 (unification vendeur = fournisseur) — tout
--     produit est rattaché à `vendeurs` (vendeur_id), le formulaire admin force
--     systématiquement ce rattachement. Pas de nouvelle colonne/contrainte.
--   - Partie 1.2 (catégorie "Sport" + 4 sous-catégories) : la catégorie
--     "Sport & EPS" et ses sous-catégories (Tenues de sport, Ballons,
--     Accessoires EPS…) existent déjà (migrations 0009/0011) — réutilisées
--     telles quelles, pas de doublon créé.
--   - Partie 2.5 (produit à variantes exclu des kits) : appliquée en code
--     (lib/admin/kits-actions.ts), pas en SQL.

-- ============================================================================
-- 1. Guide des tailles (§2.4) : affichage conditionnel sur la fiche produit.
-- ============================================================================
alter table produits add column if not exists guide_tailles boolean not null default false;

-- ============================================================================
-- 2. Fournisseur "Ndayane Sport" — point de retrait pour la carte Livraisons
--    (même schéma que Korka Diallo, migration 0068 §6). Pas de remise à ce
--    jour : chaque prix_achat est repris tel quel de la colonne "Prix Ndayane".
-- ============================================================================
insert into fournisseurs (nom)
select 'Ndayane Sport (Mor Gassama)'
where not exists (select 1 from fournisseurs where nom = 'Ndayane Sport (Mor Gassama)');
