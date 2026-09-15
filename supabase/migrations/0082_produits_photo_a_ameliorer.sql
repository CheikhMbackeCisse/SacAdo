-- SacAdo — TACHE_remplacement_14_photos.md §5 : un produit dépublié faute de
-- photo exploitable qui part quand même en commande doit être photographié
-- avant l'emballage (fond neutre, lumière du jour). Ce booléen sert de
-- rappel visible sur la fiche commande admin, posé manuellement par les
-- scripts de réparation photo (jamais par le code applicatif) tant qu'aucune
-- vraie photo n'a remplacé la source insuffisante.
alter table produits
  add column photo_a_ameliorer boolean not null default false;

comment on column produits.photo_a_ameliorer is
  'Vrai si le produit est dépublié faute de photo >= 400px exploitable. Posé par les scripts scripts/reparer-photos-*.mjs et scripts/remplacer-photos-*.mjs, levé quand une vraie photo est ajoutée.';

-- Les 20 produits encore sans photo exploitable après
-- TACHE_reparation_128_photos.md + TACHE_remplacement_14_photos.md
-- (rapport_photos_sous_400px.jsonl, généré par scripts/mesurer-photos-catalogue.mjs) :
-- 15 Yuupee (produit retiré du catalogue WooCommerce, API muette) + 5
-- Thioune Teranga (matériel réseau + souris, jamais eu de vraie photo).
update produits set photo_a_ameliorer = true where id in (
  211, 244, 318, 723, 806, 879, 925, 950, 964, 969, 981, 987, 991, 1062, 1085,
  1129, 1130, 1131, 1132, 1137
);
