# SacAdo - integration des livres Korka Diallo

Remplace la version precedente. Ajoute l'arborescence de categories, la
galerie de photos et les attributs de recherche.

Fichiers a utiliser, fournis avec ce document:
- `SacAdo_Livres_Korka_Diallo.xlsx` : 41 lignes, une par produit
- `photos_korka.zip` : 43 images, nommees exactement comme les colonnes
  Photo et Photo 2 du tableur

---

# Partie 1 - Categories et sous-categories

## 1.1 Nouvelle categorie racine

Creer **Livres et annales**, au meme niveau que Fournitures scolaires,
Informatique, Electronique, Impression et consommables et Sport.

## 1.2 Sous-categories

```
Livres et annales
├── Eveil et maternelle
├── College
├── Seconde
├── Premiere
├── Terminale
└── Concours et preparations
```

Six sous-categories, pas plus. La finesse vient des attributs, pas de
l'arborescence. Une arborescence trop profonde oblige le client a deviner
ou se trouve son livre.

## 1.3 Repartition des 41 produits

| Sous-categorie | Nombre | Contenu |
|---|---|---|
| Eveil et maternelle | 1 | Les 4 cahiers magiques |
| College | 4 | Les titres de 3e |
| Seconde | 3 | Les titres de 2nde S |
| Premiere | 11 | 1ere S, S1, S2 |
| Terminale | 14 | Terminale S, S1, S2, L |
| Concours et preparations | 8 | Concours General, EMS, EPT |

Regle de rattachement: un titre qui porte sur un concours va dans Concours
et preparations, meme s'il cible une classe precise. C'est ainsi que le
cherche un eleve qui prepare un concours.

## 1.4 Attributs, obligatoires sur chaque livre

Ce sont eux qui portent la precision, et ils alimentent les filtres et la
recherche.

```sql
alter table produits add column if not exists niveau text;
alter table produits add column if not exists serie text;
alter table produits add column if not exists matiere text;
alter table produits add column if not exists type_ouvrage text;
alter table produits add column if not exists auteur text;
alter table produits add column if not exists editeur text;
```

- `niveau` : `3e`, `2nde`, `1ere`, `Terminale`, `Maternelle`
- `serie` : `S`, `S1`, `S2`, `L`, ou vide
- `matiere` : Mathematiques, Physique, Chimie, Physique-Chimie, SVT,
  Anglais, Philosophie, Ecriture
- `type_ouvrage` : `cours`, `annales`, `recueil de devoirs`,
  `guide de l eleve`, `concours`, `cahier d activites`

La colonne Niveau du tableur melange niveau et serie, par exemple
`1ere S1`. La decouper a l'import.

## 1.5 Filtres de la categorie Livres

Barre de filtres en haut de la liste, dans cet ordre: Niveau, Serie,
Matiere, Type d'ouvrage, Prix.

Le filtre Serie n'apparait que si un niveau lycee est selectionne.

## 1.6 Recherche

Ajouter niveau, serie, matiere, type_ouvrage, auteur et editeur au champ
`recherche_texte` deja en place.

Synonymes a ajouter a la table existante, en nouveaux groupes:

```
(100,'annale'),(100,'annales'),(100,'anciennes epreuves'),(100,'sujets corriges'),
(101,'concours general'),(101,'cg'),(101,'concours general senegalais'),
(102,'bfem'),(102,'brevet'),(102,'troisieme'),(102,'3e'),
(103,'bac'),(103,'baccalaureat'),(103,'terminale'),(103,'tle'),
(104,'ems'),(104,'ecole militaire de sante'),(104,'sante militaire'),
(105,'ept'),(105,'polytechnique'),(105,'ecole polytechnique de thies'),
(106,'kaamile'),(106,'kamile'),(106,'kaamil'),
(107,'cracks'),(107,'crack en maths'),(107,'cracks en maths'),
(108,'mobama'),(108,'collection mobama'),
(109,'didactikos'),(109,'edisah'),
(110,'korka'),(110,'korka diallo'),(110,'thierno korka diallo'),
(111,'cahier magique'),(111,'cahiers magiques'),(111,'cahier a rainures')
```

Chercher "korka" doit remonter ses ouvrages. Chercher "cg physique" doit
remonter le Concours General de physique.

---

# Partie 2 - Galerie de photos

Aujourd'hui un produit porte une seule image. Deux produits de ce lot en
ont deux, et les suivants en auront davantage.

```sql
create table if not exists produits_images (
  id uuid primary key default gen_random_uuid(),
  produit_id uuid not null references produits(id) on delete cascade,
  url text not null,
  position int not null default 0,
  cree_le timestamptz not null default now()
);
create index on produits_images (produit_id, position);
```

L'image de position 0 est la principale: c'est elle qui s'affiche dans les
listes, la recherche et les kits. La fiche produit affiche un carrousel
horizontal quand il y a plus d'une image, avec des points de pagination.

Migrer l'image actuelle de chaque produit vers cette table en position 0.

Les deux produits concernes dans ce lot: le Concours General PC Terminale,
avec la couverture a plat et une mise en scene, et les 4 cahiers magiques,
avec la vue a plat et la vue en eventail.

**Traitement des images a l'import:** redimensionner a 800 pixels de large
au maximum, convertir en WebP, generer une vignette de 300 pixels pour les
listes. Les fichiers fournis font plusieurs centaines de kilooctets, ce qui
est trop lourd pour un forfait mobile senegalais.

---

# Partie 3 - Editions

## 3.1 Champs

```sql
alter table produits add column if not exists edition text;
alter table produits add column if not exists edition_statut text;
alter table produits add column if not exists couverture_epreuves text;
alter table produits add column if not exists ouvrage_id uuid;
```

`edition_statut` vaut `en_vigueur` ou `ancienne`. `ouvrage_id` est partage
par toutes les editions d'un meme ouvrage.

## 3.2 Le cas a traiter dans ce lot

Deux produits, un seul ouvrage:

- Concours General de physique TS, edition 2022, 10 000 FCFA,
  sessions 2009 a 2019 → `ancienne`
- Concours General PC Terminales S, edition 2026, 15 000 FCFA,
  epreuves de 2004 a 2025 → `en_vigueur`

Meme `ouvrage_id` pour les deux.

## 3.3 Affichage

Sous le titre: auteur, editeur ou collection, edition.

Edition en vigueur: pastille verte discrete **Edition en vigueur**, suivie
de `couverture_epreuves`.

Ancienne edition: pastille neutre **Ancienne edition**, et un encadre
d'information:

> Cette edition est anterieure au programme actuel. La pagination et les
> exercices peuvent differer de ceux demandes en classe.

Pastille neutre, jamais rouge. Le livre reste vendable et rend service a une
famille qui n'a pas les moyens de la derniere edition.

## 3.4 Comparaison

Quand un produit a des freres par `ouvrage_id`, afficher sous le prix un
bloc **Autres editions disponibles** avec, pour chacune: l'annee, le prix,
la couverture des epreuves, et l'ecart de prix calcule.

Sur la fiche du Concours General 2022, cela donne:
`Edition 2026, epreuves de 2004 a 2025, 15 000 FCFA, soit 5 000 de plus`.

## 3.5 Trois regles

1. Dans les listes et la recherche, n'afficher que l'edition en vigueur
   quand plusieurs editions partagent un `ouvrage_id`.
2. Dans l'algorithme de classement, coefficient 0,5 sur les anciennes
   editions.
3. Dans les kits par classe, jamais d'ancienne edition.

## 3.6 Alerte

Ecran d'administration listant les ouvrages dont l'edition en vigueur date
de plus de deux ans, pour interroger le fournisseur a chaque rentree.

---

# Partie 4 - Import

## 4.1 Fournisseur

Creer **Korka Diallo**, remise de 20 % sur le prix public.

Le prix de vente SacAdo est **exactement le prix public du fournisseur**.
Aucune marge ajoutee. La marge est la remise, rien d'autre.

## 4.2 Correspondance des colonnes

| Colonne du tableur | Champ |
|---|---|
| Titre | nom |
| Niveau | niveau + serie, a decouper |
| Matiere | matiere |
| Auteur | auteur |
| Editeur / collection | editeur |
| Edition | edition |
| Prix public | prix_vente |
| Prix achat -20% | prix_achat |
| Photo | image position 0 |
| Photo 2 | image position 1 |

`type_ouvrage` se deduit du titre: un titre contenant Concours donne
`concours`, Recueil de devoirs donne `recueil de devoirs`, Guide de l eleve
donne `guide de l eleve`, Annale donne `annales`, le reste `cours`.

**Tout importer en masque.** Publication manuelle apres verification.

## 4.3 Ouvrages d'autres editeurs

Cinq titres ne sont pas ecrits par Korka Diallo, il les revend. La fiche
affiche l'auteur et l'editeur reels, jamais une attribution implicite.

- SVT Premiere, Mamadou Senghor, Didactikos et Edisah, 2022
- SVT Terminale S2, Mamadou Senghor, Didactikos et Edisah, 2024
- Physique et Chimie Terminales S, Ibrahima Sakho, NEAS
- Physique Chimie Premiere S, Sidy Mohamed Ndiaye, Collection Atomic
- Physique Chimie TS2 Guide de l eleve, Mafal Fall

## 4.4 Les quatre lignes Mobama

Le catalogue du fournisseur annonce un seul prix de 10 000 pour le Mobama
Premiere et un seul pour le Mobama Terminale, alors que chaque niveau
comprend deux volumes, Physique et Chimie, avec des annees d'edition
differentes.

Le tableur les presente donc en quatre lignes distinctes.

**Ne pas publier ces quatre produits** tant que le fournisseur n'a pas
precise si les 10 000 couvrent les deux volumes ou un seul. Si la reponse
est les deux, fusionner chaque paire en un produit unique a deux images.

## 4.5 Les cahiers magiques

Ce n'est pas un livre mais un lot: quatre cahiers a rainures pour
maternelle, Alphabet, Numeros, Mathematiques et Dessin, livres avec un
stylo, des recharges et une poignee d'ecriture. L'encre s'efface, l'enfant
recommence.

A 7 900 FCFA, la description doit enumerer le contenu du lot. Sous-categorie
Eveil et maternelle, `type_ouvrage` = `cahier d activites`.

---

# Verifications

- La categorie Livres et annales apparait avec ses six sous-categories.
- Les 41 produits sont importes en masque, avec leur image principale.
- Le Concours General PC Terminale et les cahiers magiques ont deux images,
  affichees en carrousel sur la fiche.
- Toutes les images sont converties en WebP et font moins de 800 pixels de
  large.
- La fiche du Concours General 2022 affiche la pastille Ancienne edition,
  l'encadre d'information, et le lien vers l'edition 2026 avec l'ecart de
  5 000 FCFA.
- Une recherche sur "concours general physique" ne renvoie que l'edition
  2026.
- Une recherche sur "korka" remonte ses ouvrages.
- Une recherche sur "kaamile" et sur "kamile" donne le meme resultat.
- Un kit de classe ne peut pas contenir une ancienne edition.
- Filtrer sur Niveau Terminale puis Serie S2 ne renvoie que des titres S2.
- Les quatre produits Mobama restent masques.
- Chaque fiche affiche l'auteur et l'editeur reels.
