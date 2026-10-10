-- SacAdo — Reconnaissance automatique de lieu spécial (TACHE_bug_checkout_ept.md)
-- À exécuter APRÈS 0118. Additive + idempotente.
--
-- Bug : un client qui tape "École Polytechnique de Thiès" dans la recherche
-- d'adresse du checkout obtient une épingle juste placée (lieux_connus), mais
-- la livraison tombe sur "hors zone habituelle" au lieu du lieu spécial EPT
-- (lieux_speciaux, migration 0034) : resoudreLivraison() ne vérifiait les
-- lieux_speciaux que si un id était choisi explicitement dans l'autre picker,
-- jamais à partir d'un point lat/lng. On ajoute la géolocalisation + un rayon
-- de couverture sur lieux_speciaux pour que le point résolu par la recherche
-- d'adresse (ou l'épingle déplacée à la main) retrouve automatiquement le
-- lieu spécial. On ajoute aussi une liste de mots-clés (admin-éditable) pour
-- la reconnaissance par texte tapé, et une date de livraison fixe (EPT :
-- livraison groupée avant la rentrée, sans limite de commande).

alter table lieux_speciaux add column if not exists lat double precision;
alter table lieux_speciaux add column if not exists lng double precision;
alter table lieux_speciaux add column if not exists rayon_m integer;
alter table lieux_speciaux add column if not exists mots_cles text[] not null default '{}';
alter table lieux_speciaux add column if not exists date_livraison_fixe date;

-- EPT : coordonnées reprises de lieux_connus (migration 0033), rayon 800m,
-- mots-clés couvrant les variantes attendues, livraison fixée au dimanche
-- 18 octobre 2026 (veille de rentrée).
update lieux_speciaux
   set lat = 14.78896,
       lng = -16.9246,
       rayon_m = 6000,
       date_livraison_fixe = '2026-10-18',
       mots_cles = array[
         'EPT', 'E.P.T', 'polytechnique', 'polytech',
         'école polytechnique', 'ecole polytechnique',
         'polytechnique de Thiès', 'polytechnique de thies',
         'école polytechnique thies', 'ecole polytechnique thies',
         'poly thies', 'poly thiès'
       ]
 where lower(nom) like '%polytechnique%';

-- ============================================================================
-- Contrôle post-exécution
-- ============================================================================
-- select nom, tarif, mode, lat, lng, rayon_m, date_livraison_fixe, mots_cles
--   from lieux_speciaux order by nom;
