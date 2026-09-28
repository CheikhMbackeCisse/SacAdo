-- SacAdo — Retire les produits "sans photo" de l'accueil (À découvrir).
-- À exécuter dans le SQL Editor Supabase. Idempotente.
--
-- Diagnostic (scripts/diagnostiquer-photos-cassees.mjs, listage réel du
-- bucket Storage plutôt que des requêtes HTTP une par une — plus rapide et
-- fiable) : sur 1661 produits publiés avec une photo renseignée, 1631 ont un
-- vrai fichier sur Supabase Storage (rien à faire). Les 30 restants sont les
-- fiches de démonstration du tout premier lot du projet (CLAUDE.md §2 :
-- "Données de démo au départ... que l'admin remplacera par les vrais
-- produits") : leur `photo` pointe vers /images/prod-*.jpg, des fichiers qui
-- n'ont jamais existé dans public/images. `accueil_classement` filtre déjà
-- `photo is not null` (migration 0093), mais ce champ n'est PAS null ici —
-- l'URL est juste morte, d'où l'icône "sans photo" dans "À découvrir".
--
-- Fix : vider photo/photos pour ces 30 fiches. Elles sortent alors
-- automatiquement du filtre déjà existant de accueil_classement (aucun
-- changement de code nécessaire) — et arrêtent d'afficher une icône cassée
-- partout ailleurs dans l'app (catégorie, recherche, fiche produit), pas
-- seulement sur l'accueil. Elles restent publiées et trouvables : seule la
-- photo est retirée, pas la fiche. Rien à réindexer (nom_normalise /
-- recherche_texte ne contiennent pas la photo).

update produits
set photo = null, photos = '[]'::jsonb
where id in (
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 18, 19, 20, 21,
  22, 23, 25, 26, 28, 29, 30, 31, 33, 34
);

-- ============================================================================
-- Contrôle post-exécution
-- ============================================================================
-- select id, nom, photo, photos from produits
-- where id in (1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,17,18,19,20,21,22,23,25,26,28,29,30,31,33,34);
-- -> photo et photos doivent être vides pour les 30 lignes.
