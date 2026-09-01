-- SacAdo — Marketplace V2 : galerie photos produit (jusqu'à 4)
-- À exécuter APRÈS 0018, dans le SQL Editor Supabase.
-- Idempotent : peut être relancé sans erreur.
--
-- ESPACE_VENDEUR_NEGOCIATION §6 : le vendeur peut ajouter jusqu'à 4 photos,
-- choisir la principale et l'ordre. On stocke un tableau ordonné d'URLs
-- publiques dans `produits.photos` ; `photos[0]` = photo principale.
-- La colonne `produits.photo` (existante) reste SYNCHRONISÉE côté serveur avec
-- `photos[0]` pour ne rien casser dans le storefront (cartes, fiche produit,
-- RPC de recherche 0010/0011 qui font `select produits.*`).

alter table produits
  add column if not exists photos jsonb not null default '[]'::jsonb;

-- Backfill : un produit qui a déjà une photo unique -> tableau à un élément.
update produits
set photos = jsonb_build_array(photo)
where photo is not null
  and (photos is null or photos = '[]'::jsonb);
