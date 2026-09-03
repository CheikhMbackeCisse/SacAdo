# SacAdo — Document maître projet (à placer à la racine du repo)

Ce fichier est le contexte permanent du projet. Claude Code doit le lire au début
de chaque session. Il décrit la marque, les règles UI, le modèle de données, la
stack et les décisions verrouillées. Ne pas s'en écarter sans validation explicite.

---

## 1. Le produit

SacAdo est une **PWA e-commerce mobile-first** de vente de fournitures scolaires
et de matériel d'étude au Sénégal, du préscolaire à l'université. Basée à Dakar,
livraison partout dans le pays. Produit phare : les **kits scolaires prêts à
l'emploi** (une liste de fournitures par classe, achetable en un geste).

- Langue : **français**.
- Monnaie : **FCFA** (franc CFA), pas de décimales, format "12 500 FCFA".
- Cible : parents d'élèves et étudiants.
- Installable comme une app depuis le navigateur (PWA), sans passer par les stores.

## 2. Décisions verrouillées (v1)

- **Paiement : à la livraison + Wave en ligne selon un seuil.** Spec complète :
  `INTEGRATION_WAVE.md`. Règle du seuil, calculée **côté serveur** sur le total
  de la commande (sous-total + livraison) :
  * **< 10 000 FCFA** : le client choisit — Wave d'avance OU à la livraison.
  * **≥ 10 000 FCFA** : Wave d'avance uniquement (plus de paiement au livreur).
  Wave **uniquement** en v1 (pas d'Orange Money : décision reportée). Le logo
  Orange Money peut rester affiché à titre informatif (le livreur peut être payé
  ainsi à la remise pour les commandes payées à la livraison), sans intégration.
  Preuve de paiement = **webhook signé Wave** (HMAC-SHA256), jamais le simple
  retour du client sur la success_url. Clés Wave en variables d'environnement,
  jamais committées.
- **Notifications : boîte de réception in-app uniquement.** Chaque changement de
  statut de commande crée un message dans la boîte de réception du client. Pas de
  WhatsApp API en v1 (à prévoir plus tard sans casser le modèle).
- **Une seule connexion admin** (email + mot de passe). L'admin gère produits,
  stocks, commandes, statuts, kits, zones, et les vues de reporting.
- **Identité client par numéro de téléphone** (pas de compte/mot de passe côté
  client en v1). Favoris et "déjà consultés" stockés localement sur l'appareil.
- **Données de démo au départ** (~30 produits, kits, catégories, variantes), que
  l'admin remplacera par les vrais produits.

## 3. Stack technique

- **Framework** : Next.js (App Router, React, TypeScript).
- **Base de données + Auth admin + Stockage images** : Supabase (Postgres).
- **Styling** : Tailwind CSS + design system ci-dessous.
- **PWA** : manifeste + service worker (installable, icône = logo SacAdo).
- **Hébergement cible** : Vercel (front) + Supabase (backend). Gratuit au démarrage.
- Utiliser le MCP 21st.dev (Magic) et les skills UI/UX pour des composants propres.

## 4. Marque & palette (STRICTE)

Palette réduite. Chaque couleur a UN rôle unique.

| Rôle | Couleur | Usage |
|---|---|---|
| Marque / primaire | Bleu **#0B3D91** | Logo, header (voir règle header), onglet actif de la nav, accents de marque |
| Surface | Blanc **#FEFDFF** | Fond général, fond du header, fond de la bottom nav |
| Texte | Noir bleuté **#001314** | Tout le texte, titres, structure, lignes |
| Action / achat | Orange **#E07B39** (adouci, moins vif que #F17105) | UNIQUEMENT boutons d'achat (ajouter au panier, commander) et badges promo |
| Statut positif | Vert **#16A34A** | "Livrée", "Disponible" — JAMAIS sur un bouton d'action |
| Décoratif (rare) | Turquoise **#64B6AC** | Touches décoratives uniquement, jamais une action |

Règles d'or :
- **Bleu = marque, Orange = j'achète, Vert = c'est bon.** Ne jamais mélanger les rôles.
- L'orange doit être utilisé **partout** où il y a une action d'achat (sinon il perd
  son sens). Mais nulle part ailleurs.
- Texte sur orange : **noir #001314** (meilleure lisibilité que le blanc sur cet orange).
- Vert réservé aux statuts, jamais un bouton cliquable.

## 5. Règles UI transverses (tous les écrans)

### Header (fond BLANC)
- Fond blanc #FEFDFF, avec une fine bordure basse (gris clair) ou une ombre très
  légère pour le séparer du contenu.
- **Gauche** : logo "SacAdo" (le logo fourni, ou wordmark bleu). La marque reste en
  bleu pour préserver l'identité.
- **Centre** : barre de recherche occupant tout l'espace disponible, avec un
  **placeholder qui change à intervalle régulier** ("Rechercher un cahier…",
  "…une calculatrice…", "…un cartable…").
- **Droite** : icône **cœur** (favoris).
- PAS de menu hamburger. La navigation vit dans la bottom nav.

### Bottom navigation (fond BLANC)
- Fond blanc, fine bordure haute (gris clair) ou légère ombre de séparation.
- 5 entrées : **Accueil · Catégories · Panier · Commandes · Moi**.
- Inactif : icône + label en **gris**. Actif : icône + label en **bleu #0B3D91**.
- Le panier n'est PAS une icône orange dans le header ; c'est une destination de nav.
  Si un glyphe panier apparaît (écrans de détail), il est neutre avec une pastille
  de comptage en orange.

### Cartes produit
- Grille 2 colonnes dense, cartes **compactes** (pas trop hautes).
- Photo carrée, nom court (2 lignes max), **prix en taille discrète** (pas énorme),
  badge de délai (24h / 6j), petit **cœur** pour favori, bouton **"+" orange** pour
  ajouter au panier.
- Rupture : carte grisée, overlay "Épuisé", bouton désactivé.

### Général
- Sobre, rapide, dense mais épuré. PAS de fausse urgence ("plus que 2 !"), pas de
  compte à rebours, pas de pop-ups agressifs, pas de coupons clignotants.
- Marque de confiance locale : honnêteté avant tout. Si un produit est en rupture,
  il est marqué en rupture, point.
- Séparation visible header/contenu/nav (bordures fines ou ombres légères).

## 6. Desktop
Même structure, layout élargi. Header en haut (logo gauche, recherche centrale large,
cœur droite). La nav peut devenir une barre haute ou latérale avec les 5 mêmes
destinations. Grille produit en 4–6 colonnes. Desktop = priorité secondaire mais
doit rester cohérent avec le mobile.

## 7. Images fournies
Les images (logo + photos produits/catégories) seront placées dans `/public/images/`.
Convention de nommage : `logo.png`, `cat-<slug>.jpg` (catégories),
`subcat-<slug>.jpg` (sous-catégories), `prod-<slug>.jpg` (produits).
IMPORTANT : compresser les images (< 200 Ko) pour les connexions mobiles.
Tant que les vraies images ne sont pas là, utiliser des placeholders.

## 8. Parcours clés
- **Accueil** : carrousel pub → grille catégories (2 rangées × 5 colonnes, scroll
  horizontal, 3 colonnes visibles + amorce de la 4e) → produits populaires.
- **Kits** : catégorie Kits → écran cycle (Préscolaire/Élémentaire/Collège/Lycée) →
  classe → **écran des gammes** (Essentiel / Confort / Complet — noms verrouillés,
  pas de "premium") → écran du kit de la gamme (liste pré-cochée, on décoche, on
  ajuste, on ajoute). L'ebook de la classe est offert avec l'achat du kit complet,
  quelle que soit la gamme (affichage seulement en v1). Voir `kits.gamme` dans
  MODELE_DONNEES.md.
- **Catégorie** : rangée de sous-catégories illustrées (façon SHEIN) → grille produits.
- **Produit** : galerie photos → variantes (couleur/taille, stock par variante) →
  ajouter au panier.
- **Panier** : barre de progression vers la livraison gratuite (50 000 FCFA) → total.
- **Checkout** : coordonnées → zone → mode livraison (24h/6j) → paiement à la
  livraison → confirmer.
- **Suivi** : stepper Reçue → En préparation → En livraison → Livrée (vert).
- **Moi** : mes commandes, boîte de réception, favoris, déjà consultés, assistance,
  + icône Paramètres (langue, compte, confidentialité, déconnexion).

Voir MODELE_DONNEES.md pour le schéma complet.
