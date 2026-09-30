# CORRECTIONS_V16 : cahiers du préscolaire, éponges, version ordinateur

Méthode habituelle : par lots, point de contrôle après chaque lot.

---

## Lot 1 : kits (script `scripts/corriger-kits-v16.mjs`, `--dry-run` d'abord)

Sauvegarder `kit_items` avant (`backups/kit_items_avant_v16_<date>.json`).

**A. Préscolaire (9 kits : Petite, Moyenne, Grande section × 3 gammes)**
Au préscolaire, pas de cahiers de 100 pages : des cahiers de 48 pages et des cahiers de
dessin de 32 pages.
- Supprimer les lignes du produit 1618 (cahier 96 pages) et du produit 1286 (cahier de
  dessin TPG) dans ces kits.
- Ajouter ou mettre à jour, dans les 3 gammes :
  | Classe | 1575 « Cahier L'écolier 48 pages » | 1572 « Cahier de dessin L'écolier 32 pages » |
  |---|---|---|
  | Petite section | 1 | 1 |
  | Moyenne section | 2 | 1 |
  | Grande section | 3 | 2 |
  Groupes : 1575 dans « Cahiers » (libellé « Cahier 48 pages »), 1572 dans « Art &
  dessin » (libellé « Cahier de dessin 32 pages »). Section Principal, cochés.
- Garder le cahier de travaux pratiques 200 pages.

**B. Éponges (préscolaire et élémentaire)**
- Remplacer le produit 1224 « Eponge Expanding Sponge » (éponge pour tableau blanc) par le
  produit **1202 « Boîte à éponge »** (petite boîte ronde, pour l'ardoise), dans tous les
  kits de ces deux cycles et dans les 3 gammes. Libellé « Éponge », quantité 1.
- Vérifier que 1202 est publié et visible.

**Contrôles** : rapport kit par kit (avant / après), puis total de chaque kit ; l'ordre
Essentiel < Complet < Confort doit rester respecté dans chaque classe.

---

## Lot 2 : version ordinateur (à partir de 1024 px de large)

Le mobile ne change pas. Sur ordinateur, l'app reprend aujourd'hui la mise en page mobile
étirée : par exemple, une fiche produit prend toute la largeur avec une image géante.

### 2.1 Regarder un produit sans quitter la liste
- Depuis une liste (accueil, catégorie, recherche, favoris), cliquer sur un produit ouvre un
  **panneau d'aperçu à droite** (environ 440 px de large) : photos, nom, prix, délai,
  variantes, quantité, bouton « Ajouter au panier », lien « Voir la fiche complète ». La
  grille reste visible et cliquable à gauche : cliquer sur un autre produit remplace
  l'aperçu.
- L'adresse change (`/produits/<slug>`) pour pouvoir partager ou revenir en arrière (route
  interceptée et slot parallèle de l'App Router). Échap et le bouton × ferment le panneau.
  Recharger la page ou ouvrir le lien directement affiche la fiche complète.

### 2.2 Fiche produit complète
- Largeur de contenu limitée (environ 1 200 px), centrée.
- Deux colonnes : galerie à gauche (image principale limitée à 520 px, miniatures
  dessous), informations et achat à droite, bloc d'achat qui reste visible au défilement.
- **Colonne « Produits similaires » à droite ou juste sous la zone d'achat, visible sans
  défiler** : même sous-catégorie d'abord, avec image, prix et bouton « + ».
- Images jamais agrandies au-delà de leur taille réelle (pas de flou).

### 2.3 Autres pages
- **Accueil** : bannière moins haute ; toutes les catégories visibles d'un coup (pas de
  défilement horizontal) ; « À découvrir » sur 5 à 6 colonnes.
- **Grilles produits** : 4 à 6 colonnes selon la largeur ; au survol d'une carte, légère
  ombre et bouton « + » bien visible.
- **Catégories** : grille de 4 à 6 colonnes.
- **Page d'un kit** : deux colonnes, la liste des articles à gauche, un récapitulatif fixe à
  droite (total, nombre d'articles, pour qui, bouton « Ajouter le kit »).
- **Panier et commande** : deux colonnes, articles ou formulaire à gauche, récapitulatif fixe
  à droite.
- **Bandeau « Pour une meilleure expérience, téléchargez l'app »** : ne pas l'afficher sur
  ordinateur (l'icône d'installation du header suffit).
- Barre de recherche : touche « / » pour y placer le curseur.
- Contenu toujours centré avec une largeur maximale, jamais collé aux bords sur un écran
  large.

### 2.4 Vérification
Captures à 1024, 1280, 1440 et 1920 px : accueil, catégorie, aperçu produit ouvert, fiche
produit complète, page d'un kit, panier, commande. Vérifier aussi qu'à 360 px rien n'a
changé.

---

## Déploiement
`tsc`, `eslint`, `npm test`, `next build`, puis `vercel --prod --yes`.
