-- SacAdo — Marques & collections (maj-26-09/PROMPT-maj-catalogue-26-09.md §4)
-- À exécuter dans le SQL Editor Supabase. Additive + idempotente.
--
-- `produits.marque` existe déjà (rempli pour l'électronique/informatique).
-- Ce chantier le complète pour la papeterie/écriture/dessin et ajoute un
-- champ `collection`, utilisé uniquement pour les livres (jamais l'éditeur,
-- qui reste dans `produits.editeur`).

alter table produits add column if not exists collection text;

comment on column produits.collection is
  'Collection éditoriale d''un livre (ex. "La Clé des Cracks", "Bled"). Jamais renseigné hors catégorie Livres. Ne remplace pas `editeur`.';

-- ============================================================================
-- Contrôle post-exécution
-- ============================================================================
-- select count(*) from produits where collection is not null;
