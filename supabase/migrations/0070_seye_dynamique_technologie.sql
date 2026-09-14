-- SacAdo — Seye Dynamique Technologie (TACHE_seye_dynamique_integration.md +
-- TACHE_sdt_correctif.md). À exécuter APRÈS 0069, dans le SQL Editor
-- Supabase. Idempotent : peut être relancé sans erreur.
--
-- Ce que fait cette migration :
--   1. `vendeurs` : deux grilles de tarification par palier (remise fournisseur,
--      majoration SacAdo), éditables sans redéploiement — TACHE_sdt_correctif.md §1.
--   2. `produits` : attributs techniques des machines reconditionnées (filtres
--      + garantie), `etat` et `marque`.
--   3. `commande_items.garantie_fin` : figée à la livraison (date + garantie_mois).

-- ============================================================================
-- 1. VENDEURS : grilles de remise / majoration par palier
-- ============================================================================
-- Format : tableau ordonné de paliers [{ "seuil": <borne haute EXCLUSIVE du
-- prix affiché, ou null pour le dernier palier>, "valeur": <montant> }, ...].
-- Ex. grille_remise d'un fournisseur : prix affiché < 150000 -> 10000 FCFA ;
-- < 200000 -> 15000 ; < 300000 -> 20000 ; sinon -> 25000.
alter table vendeurs add column if not exists grille_remise jsonb;
alter table vendeurs add column if not exists grille_majoration jsonb;

-- ============================================================================
-- 2. PRODUITS : attributs techniques (ordinateurs reconditionnés)
-- ============================================================================
alter table produits add column if not exists processeur text;
alter table produits add column if not exists ram_go int;
alter table produits add column if not exists stockage_go int;
alter table produits add column if not exists type_stockage text;
alter table produits add column if not exists taille_ecran numeric(3,1);
alter table produits add column if not exists ecran_tactile boolean;
alter table produits add column if not exists convertible boolean;
alter table produits add column if not exists etat text;
alter table produits add column if not exists garantie_mois int;
-- Marque (ex. "Dell", "HP", "Apple") : pas demandée par le document mais
-- nécessaire au filtre "Marque" de la sous-catégorie Ordinateurs portables —
-- dérivable du nom mais stockée pour rester fiable et filtrable en base.
alter table produits add column if not exists marque text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'produits_etat_check'
  ) then
    alter table produits add constraint produits_etat_check
      check (etat is null or etat in ('neuf', 'reconditionne'));
  end if;
end $$;

-- ============================================================================
-- 3. COMMANDE_ITEMS : date de fin de garantie, figée à la livraison
-- ============================================================================
alter table commande_items add column if not exists garantie_fin date;
