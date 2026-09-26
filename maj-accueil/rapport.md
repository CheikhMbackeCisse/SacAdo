# Rapport — maj-accueil (accueil, catégories, paramètres, logos, livraison)

## 1. Catégories

- Catégorie « Marques » retirée de la page Catégories (tuile supprimée dans
  `app/(storefront)/categories/page.tsx`). Elle n'apparaissait déjà pas sur
  l'accueil. Les pages `/marques/[slug]` restent accessibles (recherche,
  lien depuis une fiche produit) — rien à ce niveau n'a changé.
- Fournitures d'école ↔ Imprimerie et Écriture ↔ Mobilier : ordres échangés
  en base (colonne `categories.ordre`). Nouvelle photo posée sur Fournitures
  d'école (`public/images/cat-fournitures-ecole.webp`).

## 2. Paramètres (écran Moi)

La zone « Trouver un produit avec une photo » (`/moi`, pas `/moi/parametres`
qui ne contenait que Langue/Préférences) est remplacée par :
1. Un champ de recherche texte dans un cadre, qui poste vers `/recherche`
   (même moteur/synonymes que la barre principale).
2. En dessous, hors cadre, « Donnez-nous votre liste de fournitures et on
   s'occupe du reste » + le même formulaire que sur `/kits` (origine
   `liste_fournitures`).

Le formulaire (kits **et** Moi) accepte désormais JPG/PNG/WebP/HEIC/PDF/
Word/Excel jusqu'à 10 Mo (sniffing des magic bytes, comme pour les photos),
via une nouvelle fonction `televerserFichierDemande`. Le téléphone est
désormais facultatif pour cette origine. La demande est enregistrée dans
`demandes_produits` (colonne `photo_url`, réutilisée aussi pour un fichier
non-image) et l'admin (`/admin/recherches`) affiche un lien « Voir le fichier
joint » au lieu d'un aperçu quand ce n'est pas une image.

L'origine `photo_produit` (devenue inutilisée) a été retirée du code.

## 3. Logos

- Logo de l'en-tête remplacé par le logo fond bleu (`logo-entete-96.webp`).
- Logos Maped/Schneider remplacés par les nouveaux fichiers.
- Logo agrandi à 24 px sur la carte produit (déjà positionné au-dessus du
  nom) et à 36 px sur la fiche produit.

## 4. Prix

| Produit | Ancien prix | Nouveau prix |
|---|---|---|
| Kit de Traçage 30 cm 4Pcs – MAPED (id 1585) | 900 F | 1 500 F |
| Kit de Traçage 30 cm 4Pcs Nightfall – MAPED (id 1595) | 900 F | 1 500 F |
| Cartable bleu et mauve motif lapin (id 1194) | 7 470 F | 7 500 F |

Les trois ont été retrouvés sans ambiguïté (un seul produit correspondant
chacun) ; les kits qui les contiennent se recalculent automatiquement.

## 5. Mise en avant sur l'accueil

Le mécanisme existait déjà (`classement_manuel.position`, épinglage) : pas de
nouveau champ créé. Corrigé pour garantir que les épinglés ouvrent
**toujours** le flux, dans l'ordre exact de leur position (avant, la règle de
variété/rentrée pouvait les faire glisser — voir `lib/accueil.ts` et
`lib/accueil-diversite.ts`).

Sur les 15 produits de la liste, **10 résolus sans ambiguïté** et épinglés :

| # | Produit | id |
|---|---|---|
| 2 | Cahier Calligraphe 180 pages petit format | 1609 |
| 3 | Post-it 5 blocs | 1239 |
| 4 | Kit de traçage Maped | 1585 |
| 5 | Kit de traçage Maped Nightfall | 1595 |
| 6 | Gourde graduée motivationnelle orange | 1274 |
| 7 | Cartable rigide bleu marine | 1199 |
| 8 | Cartable bleu et mauve motif lapin | 1194 |
| 10 | Un livre de Korka Diallo (Mathématiques 3e) | 39 |
| 11 | Le livre « 4 cahiers magiques » | 79 |

**5 non résolus, à confirmer** (aucune supposition faite) :
- **1. Trousse Hello bleue** — introuvable telle quelle ; le catalogue a
  « Trousse Hello monstre vert/ourson violette/radio bleue/pingouin
  menthe/bus rouge/chat rose », aucune simplement « bleue ».
- **9. Un sac Eastpak (le moins cher publié)** — aucun produit Eastpak au
  catalogue (ni dans le nom, ni dans la marque).
- **12. Une si longue lettre** — 2 produits identiques (id 1301 à 3 500 F,
  id 1434 à 3 900 F) : doublon apparent, à trancher.
- **14. L'Os de Mor Lam** — 2 produits (id 1323 à 3 500 F, id 1421 à
  3 900 F) : même doublon apparent.
- **15. Ami et Rémi** — 10 titres différents portent ce nom de collection
  (grammaire/lecture/maths, par classe CI à CM2) : lequel épingler n'est pas
  précisé.

**⚠️ Constat en testant sur le serveur de dev** : 4 des 10 produits épinglés
(Post-it 5 blocs, Gourde orange, Cartable rigide bleu marine, Cartable lapin)
ont un **stock à 0** en base actuellement. L'accueil les exclut donc
automatiquement (règle déjà en place : jamais un produit en rupture affiché,
épinglé ou pas) — ils ne remonteront qu'une fois réapprovisionnés. Vérifié en
conditions réelles : l'accueil démarre bien par 1609, 1585, 1595, 39, 79 (les
6 autres suivent dès que le stock revient).

### Autres règles de la section 5

- Ordinateurs à 175 000 F ou plus : exclus de l'accueil (filtre applicatif
  dans `lib/accueil.ts`, catégorie Informatique + prix), toujours visibles en
  catégorie/recherche.
- Tech rare : plafonnée à 1/8 du flux (`lib/accueil-diversite.ts`), au-delà de
  8 produits affichés — testé unitairement.

## 6. Chargement continu

Ajouté partout où il manquait : **accueil** (nouveau, avec graine de session
stable pour ne pas remélanger le début du flux à chaque page), **résultats de
recherche** (limite progressive 48→+24), **Favoris** et **Déjà consultés**
(révélation progressive d'une liste déjà chargée). Catégorie et Marque
l'avaient déjà. Message « Demandez-le-nous » en fin de liste partout, bouton
« Charger plus » uniquement si le chargement automatique échoue.

## 7. Livraison à une date donnée

- `lib/checkout/date-livraison.ts` (testé unitairement, 6 cas dont les deux
  exemples de la consigne — mercredi 30/09 → 4/10, dimanche 4/10 → 10/10).
- Checkout : les deux options s'affichent « Livraison express (moins de
  24h) » et « Livraison le \<date> » (jamais « 6 jours », « dimanche »,
  « samedi » côté client) — confirmation, suivi, et fiche commande admin
  repris de même.
- Admin `/admin/zones` : réglage de l'heure limite du samedi (vide = aucune)
  et des dates fermées (ajout/retrait). Admin `/admin/commandes` : filtre par
  date de livraison + badge « Express » / date sur chaque commande.
- Toute mention « 6 jours » retirée du client (accueil, CGV, assistance,
  fiche produit, suivi) et de l'admin (zones, carte livraisons, bon de
  préparation, formulaire produit) — les valeurs internes `'6j'`/`tarif_6j`
  restent inchangées comme demandé.

**⚠️ Migration à exécuter avant mise en prod** : `supabase/migrations/0089_livraison_datee.sql`
(ajoute `commandes.date_livraison_prevue` et la table `dates_fermees`) —
c'est une modification de schéma, je ne peux pas l'exécuter moi-même ; voir
le message de fin de session pour le SQL complet à coller dans l'éditeur
Supabase.

## Build et tests

`npm run build`, `npm test` (62 tests, dont 7 nouveaux : date de livraison et
plafond tech) et `npx eslint .` passent sans erreur sur tous les fichiers
touchés.

## Reste à faire

- Exécuter la migration 0089 (ci-dessus).
- Trancher les 5 produits non résolus de la mise en avant (§5).
- Réapprovisionner (ou choisir d'autres produits) pour les 4 épinglés
  actuellement en rupture.
- Test manuel en navigateur non fait (session sans accès Chrome pour cette
  partie) : vérifié par sonde HTTP (pages 200, contenu du flux d'accueil
  inspecté côté serveur) mais pas cliqué à la souris.
