# Rapport d'import Papex

Généré le 2026-09-25 par `scripts/importer-papex.mjs`.

## Résumé

- Fournisseur **Papex** créé (`vendeurs`, grille_majoration `null` : prix fixés pièce par pièce dans le catalogue, comme Seye Dynamique).
- **114 produits créés** (0 mise à jour possible : aucune correspondance trouvée dans le catalogue existant, voir plus bas).
- **256 fichiers image téléversés tels quels** dans `produits/papex/` (variantes -400/-800/-1200, aucun réencodage).
- **92 publiés**, répartition conforme à l'attendu : Cahiers & papeterie 34, Écriture 12, Mobilier 11, Imprimerie 11, Fournitures d'école 10, Matériel géométrique 7, Art & dessin 4, Hygiène & cantine 1, Livres et annales 1, Informatique 1.
- **22 non publiés** : 21 pour prix de vente ambigu (voir liste), 1 (SAC-002) pour photo inutilisable.
- `produits_a_depublier.json` : **aucune écriture**. Ce fichier ne référence pas des produits SacAdo existants à retirer de la vente — c'est la liste des 137 articles du catalogue Papex qui n'ont *pas* été retenus (125 sans prix trouvable, 5 vendus uniquement dans l'ensemble Superman SAC-003, 7 déjà couverts par Yuupee). Le rapprochement contre les 1563 produits déjà en base (recherche exacte puis normalisée puis floue) n'a par ailleurs trouvé aucune correspondance pour aucun des 114 produits du catalogue ni pour les 137 de ce fichier.

## Non publiés faute de prix de vente fiable (21)

Prix relevé mais unité ambiguë (pièce ou paquet) — `prix = 0`, `prix_a_verifier = true` (visibles sur `/admin/prix-a-verifier`), aucun prix inventé.

- SAC-045, SAC-051, SAC-056, SAC-059, SAC-080, SAC-081, SAC-082, SAC-083, SAC-084, SAC-085, SAC-091, SAC-092, SAC-093, SAC-094, SAC-095, SAC-096, SAC-097, SAC-098, SAC-099, SAC-100, SAC-101 (sous-chemises SUPER 60 et chemises FOREVER).

## Non publié faute de photo (1)

- SAC-002 — Trousse ovale : seule photo disponible porte le logo Papex. Créée en base sans image, `motif_refus` renseigné, marque non stockée (article textile vendu sous désignation générique, jamais affichée côté client).

## À vérifier à l'œil (photos retouchées ou possiblement inexactes)

- SAC-001, SAC-003, SAC-004, SAC-005 : photo retouchée pour effacer le logo Papex — vérifier que l'emballage/l'article reste conforme.
- SAC-113 : la photo montre un jeu de 12 intercalaires, la désignation dit "6 positions" — à confirmer avant de lever tout doute.

## Vérifications automatiques faites

- Comptage publiés par catégorie : conforme (92, détail ci-dessus).
- 10 fiches contrôlées dont SAC-003 et SAC-066 : prix affiché, catégorie, photo `.webp` servie depuis Supabase (`produits/papex/…`), aucune requête `/_next/image` ni `/render/image`.
- SAC-115 : les 3 photos (principale + 2 secondaires) s'affichent dans la galerie.
- Les 22 produits non publiés renvoient 404 côté vitrine (RLS : invisibles tant que non publiés).
- Les 256 fichiers référencés par le catalogue existaient tous sur disque avant l'import, aucun sous 400 px de large.
