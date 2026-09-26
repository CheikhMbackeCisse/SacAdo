# Rapport — maj-publication (produits en attente, nouveaux produits, Korka)

## 1. Produits en attente publiés

**92/92 publiés** : 59 Yuupee, 32 Seye Dynamique Technologie, 1 SacAdo (le
paquet de copies doubles, id 1716). Statuts `refuse` (21) et `archive` (33)
non touchés.

Nettoyage des noms (32 produits concernés) : préfixe « Roll over image to
zoom in » retiré (id 1001) ; aucune entité HTML trouvée dans ce lot ; les
noms entièrement en MAJUSCULES (ex. « CRUCIAL BARETTE DDR4 16GB... ») mis en
casse normale (« Crucial Barette DDR4 16GB... »), en gardant en majuscules
les codes/modèles (contiennent un chiffre) et les sigles courts (HP, USB,
SSD...). Un deuxième passage a corrigé quelques mots courts pris à tort pour
des sigles (Noir, Bleu, pour, dur, Card, Jeu).

**1 produit publié sans image** — à illustrer :
- id 1716 — Paquet de copies doubles grand format

## 2. Les 33 produits archivés (laissés en l'état, à confirmer)

- **id 36** — Cahier premium 96 pages — test vendeur (vendeur « Librairie
  Test ») : produit de test.
- **id 1182** — Boite a gouter avec gourde (fournisseur LPD) : doublon
  fusionné avec d'autres boîtes à goûter.
- **31 produits SacAdo (ids 1–23, 25, 26, 28–31, 33, 34)** : sans fournisseur
  réel, stocks qui semblent inventés (ex. 300 gommes, 250 crayons...) ; au
  moins un doublon confirmé — id 16 « Calculatrice scientifique Casio
  FX-92 » à 12 000 F double bien la vraie, id 1592 « Calculatrice Casio
  fx-92 Collège Classwiz », publiée à 8 000 F.

Aucun n'a été publié — liste fournie pour confirmation, comme demandé.

## 3. Nouveaux produits

| Produit | Résultat |
|---|---|
| Pack Livre parlant 300+ mots + 4 cahiers magiques offerts | **Créé** (id 1726), 12 900 F / achat 10 320 F, Livres et annales > Éveil et maternelle, marque Leleyu, publié avec photo. |
| Les 4 cahiers magiques | **Déjà au catalogue** (id 79, importé lors du chantier Korka précédent) : prix, catégorie, statut et 2 photos déjà conformes — aucune modification nécessaire. Déjà dans la liste « mis en avant » de l'accueil (position 11). |
| Calculatrice scientifique Casio fx-991ES Plus | **Créée** (id 1727), 4 750 F / achat 3 700 F, Fournitures d'école, marque Casio (pas de logo dédié dans l'app : affichage texte seul, comportement déjà géré par le code existant), publiée avec photo. |

## 4. Contrôle du catalogue Korka Diallo (`scripts/verif-korka.mjs`)

**Avant corrections** : 37 lignes conformes, 4 avec écarts (les quatre
Mobama — PC Première S1/S2 et PC Terminale S — publiées alors qu'elles
doivent rester masquées tant que le fournisseur n'a pas confirmé si 10 000 F
couvre un seul volume ou les deux).

**Corrections appliquées** : les 4 Mobama repassées en `en_attente`
(masquées). Aucun écart de prix, aucune image manquante, aucun doublon,
aucun titre introuvable — le catalogue Korka (41 livres) avait déjà été
correctement importé lors d'un chantier précédent.

**Après corrections, script relancé** : **41/41 lignes présentes, 4 Mobama
masquées, 0 correction appliquée** (idempotent, confirmé par un second
passage).

Recherche vérifiée : « clé des cracks », « cahiers magiques » et « livre
parlant » donnent bien des résultats.

## Build et tests

`npm run build`, `npm test` et `npx eslint .` passent sans erreur.

## Reste à faire

- Confirmer (ou non) la publication des 33 produits archivés listés en §2.
- Illustrer le paquet de copies doubles (id 1716) — aucune image fournie.
- Relancer le fournisseur sur les 4 Mobama (prix pour un ou deux volumes).
- Trouver une photo pour le paquet de copies doubles.
