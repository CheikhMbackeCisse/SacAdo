-- CORRECTIONS_KITS Lot 5 §2 : mosaïque d'images par kit curée à la main
-- (onglet "Images du kit" de kits_sacado_final.xlsx : cahier, géométrie,
-- livre, stylos). Remplace la logique générique "4 premières photos
-- principales" qui pouvait afficher 4 fois le même groupe (ex. 4 cahiers)
-- selon l'ordre des lignes du kit.
alter table kits add column if not exists images_mosaique bigint[];

comment on column kits.images_mosaique is
  'Jusqu''à 4 ids produits, dans l''ordre d''affichage de la mosaïque (curation manuelle, script scripts/lot5-images-kits.mjs). Null/vide = repli sur la logique générique (photosMosaique).';
