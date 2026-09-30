# PROMPT CLIENT : côté app client

Regroupe les changements côté client demandés par le fondateur depuis le dernier prompt
envoyé. Méthode habituelle : par lots, capture d'écran après chaque lot, puis déploiement.

## Lot 1 : les premiers produits de « À découvrir » (accueil)

Utiliser le mécanisme d'épinglage existant (`/admin/classement`,
table des épinglages) : des données en base, rien en dur dans le code, pour que le
fondateur puisse ensuite changer l'ordre lui-même.

#### 1. Retirer
- **1577 « Calculatrice Texas Instruments TI-83 Premium CE Python » (83 000 FCFA)** : ne
  plus l'afficher dans « À découvrir » (ni épinglée, ni remontée par le classement
  automatique). Elle reste dans le catalogue, les catégories et la recherche. Si le
  mécanisme ne permet pas d'exclure un produit de l'accueil, ajouter cette option dans
  `/admin/classement` (« Ne pas montrer sur l'accueil »).

#### 2. Ordre des premières places
Les produits utiles à la rentrée en haut, l'informatique et l'imprimante plus bas.

| Place | ID | Produit | Prix |
|---|---|---|---|
| 1 | 1727 | Calculatrice scientifique Casio fx-991ES Plus | 4 750 |
| 2 | 1715 | Cahier Calligraphe 200 pages grand format | 1 600 |
| 3 | 1726 | Pack Livre parlant 300+ mots + 4 cahiers magiques offerts | 12 900 |
| 4 | 1636 | Pack de 4 stylos Schneider Tops 505 M | 400 |
| 5 | 1301 | Une si longue lettre (Mariama Bâ) | 3 500 |
| 6 | 1682 | Le Robert dictionnaire de français 65 000 mots | 3 500 |
| 7 | 1290 | Kit de géométrie YPP School Supplies | 1 600 |
| 8 | 1303 | Nini, mulâtresse du Sénégal (Abdoulaye Sadji) | 3 500 |
| 9 | 1307 | L'Étranger (Albert Camus) | 2 800 |
| 10 | 1199 | Cartable rigide bleu marine | 7 500 |
| 13 | 90 | Dell Latitude 3190 2-en-1 | 95 000 |
| 14 | 95 | Dell Latitude 5400 | 160 000 |
| 15 | 435 | Écran ordinateur HP M27F 27 pouces | 167 500 |
| 16 | 654 | Canon i-SENSYS MF463dw | 355 000 |

- Les places 11, 12 et au-delà de 16 restent au classement automatique.
- Attention aux doublons inactifs : utiliser 1301 (pas 1434) pour « Une si longue lettre »
  et 1682 (pas 1426) pour le dictionnaire, les seuls visibles.
- Si le quota par sous-catégorie du classement automatique empêche deux livres ou deux
  ordinateurs d'être proches, les épinglages passent avant le quota.

#### 3. Vérifications
- Chaque produit épinglé est publié, visible et a une image (sinon il est exclu de
  « À découvrir » depuis V14 : me le signaler).
- 1301, 1303 et 1307 ont un stock de 0 dans le dernier export : vérifier qu'ils peuvent
  être commandés (même règle que les autres produits sur commande), sinon me le dire.
- Capture de l'accueil sur 360 px (les 16 premières cartes) et sur 1280 px.
- `tsc`, `eslint`, `npm test`, `next build`, puis `vercel --prod --yes`.
