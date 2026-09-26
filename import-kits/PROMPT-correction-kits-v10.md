# Correction complète des kits scolaires : version 10

Les kits ont déjà été intégrés avec une version précédente de `import-kits/kits.json`. Ce prompt remplace toutes les corrections précédentes : applique-le en entier, même si une partie a déjà été faite.

Remplace d'abord le contenu du dossier `import-kits/` par celui fourni : `kits.json` (version `2026-09-26-v10`), `SacAdo_kits_v10.xlsx`, `PROMPT-claude-code-kits.md` et ce fichier.

Les kits sont composés côté SacAdo. Ne change pas leur composition : pas de ligne ajoutée, retirée ou remplacée par un produit « équivalent ». Une référence introuvable se signale, elle ne se remplace pas.

## Ce qui ne change pas

Un kit ne stocke jamais de prix. Son prix est la somme `quantité x prix de vente actuel` des lignes cochées, calculée par une seule fonction utilisée partout. Quand le prix ou le statut d'un produit change, les kits qui le contiennent changent, et leurs caches sont invalidés. Vérifie que c'est toujours vrai après ta correction.

## Le résultat attendu

63 kits : 21 classes, 3 gammes (Essentiel, Complet, Confort).

- Élémentaire : CI, CP, CE1, CE2, CM1, CM2
- Collège : 6e, 5e, 4e, 3e
- Lycée : Seconde L, Seconde S, Première L, Première S1, Première S2, Terminale L, Terminale S1, Terminale S2
- STEG : Seconde STEG, Première STEG, Terminale STEG

Le lycée arabe n'a pas de kit : il affiche seulement un message (point 5).

## 1. Séparer S1 et S2 en Première et en Terminale

- Supprime, avec leurs lignes, les kits dont le slug figure dans `slugs_supprimes` : ce sont les anciens kits Première S et Terminale S, non séparés.
- La Seconde S reste une seule classe. La séparation commence en Première.
- Le champ `serie` accepte `L`, `S`, `S1`, `S2` et `STEG`. Le sélecteur de série du lycée affiche : L et S en Seconde ; L, S1, S2 en Première et en Terminale ; STEG aux trois niveaux.
- S1 et S2 ont les mêmes matières, avec des horaires et des coefficients différents. Leurs fournitures sont donc identiques : ce n'est pas une erreur. La différence est dans les livres.
- Les livres de Korka Diallo (références `CDC-...`) sont maintenant les vrais titres de son catalogue, importé avec la tâche « Livres Korka Diallo ». Chaque entrée de `references` donne le titre exact (avant la parenthèse) et une consigne `recherche`. Rattache par ce titre, sans tenir compte de la casse ni des accents ; si l'app a rendu les titres plus lisibles, rattache par niveau + série + matière + auteur. Les éditions S1 et S2 sont différentes (`CDC-1M-S1` : Maths 1S1 Cracks en maths ; `CDC-1M-S2` : Maths 1S2 La Clé des Cracks ; `CDC-TM-S1` : Maths TS1 épreuves du bac ; `CDC-TM-S2` : Maths TS2 La Clé du Bac) : ne rattache jamais l'une à la place de l'autre. `CDC-1PC` (Physique Chimie Première S, Collection Atomic) est commun à S1 et S2. Jamais d'ancienne édition dans un kit. Un livre Korka encore masqué se rattache quand même : signale-le, car la ligne restera cachée tant qu'il n'est pas publié.

## 2. Publier les kits STEG

La série STEG a maintenant ses 9 kits, comme les autres séries. Ils ont été composés à partir des matières et coefficients du Complexe Saint-Michel, faute de liste de fournitures ; SacAdo a décidé de les publier tels quels.

- S'ils existent déjà (version 4), l'import les met à jour. Sinon, il les crée.
- Si une correction précédente a affiché « Les kits de la série STEG ne sont pas encore disponibles », retire ce message.
- Aucune mention publique du fait que la liste est reconstituée : `type_source` et `source_interne` restent réservés à l'admin.

## 3. Nouvelle composition du Complet et du Confort

Le Complet était trop cher et trop proche du Confort. Au collège, au lycée et en STEG :

- les manuels scolaires, le stylo 4 couleurs et le correcteur passent du Complet au Confort ;
- le Complet a une calculatrice scientifique générique (`S015`) ; la Casio fx-92 (`SAC-022`) la remplace dans le Confort.

Le primaire ne change pas : ses manuels Didactikos restent dans le Complet.

Dans l'Essentiel du collège, du lycée et de la STEG, le taille-crayon est maintenant le Maped à réservoir (`SAC-017`). L'ancienne référence `S030` était une boîte à éponge : elle n'est plus dans aucun kit.

Le Complet et le Confort du collège, du lycée et de la STEG ont maintenant un protège-cahier par cahier, sur deux lignes : petit format (`S109`, 150 F l'unité) et grand format (`A-CREER-04`). Si l'app n'a qu'un seul protège-cahier, rattache-le à `S109` et signale que `A-CREER-04` est introuvable : ne mets pas un petit format sur un cahier grand format.

Tu n'as rien à coder pour ça : relance le script d'import avec le nouveau `kits.json`. Il remplace les lignes et les descriptions de chaque kit.

## 4. Retirer l'ebook offert

Les ebooks ne sont pas encore prêts. Retire toute mention « Ebook offert » : page de kit, carte de kit, page de classe, panier, e-mails, balises de partage. Supprime le champ `ebook_offert` du modèle s'il a été créé (migration). Si le supprimer casse quelque chose, laisse-le à faux partout et dis-moi ce que tu as choisi. Ne supprime aucun produit.

## 5. Lycée arabe : kits pas encore disponibles

`series_a_venir` ne contient plus que le lycée arabe (profils scientifique S1A/S2A et littéraire LA/L-AR), en Seconde, Première et Terminale.

Affiche-le dans le choix des séries avec son `message` : « Les kits du lycée arabe ne sont pas encore disponibles. » C'est un petit texte simple sous le nom de la série, dans le style du texte courant. Pas de cadre, pas de carte, pas d'encadré, pas de fond coloré, pas d'icône d'alerte. Pas de prix, pas de bouton d'achat, pas de date, pas de lien vers un kit. Si un cadre ou une carte a déjà été codé pour ces séries, retire-le.

Aucune autre série technique n'est affichée (S3, T1, T2, F6...).

## 6. Relancer l'import

- Upsert sur le `slug`. Les lignes de chaque kit sont remplacées par celles du fichier.
- Les kits **nouveaux** sont créés en `statut = masque`. Les kits **existants gardent leur statut** : ne dépublie pas un kit que l'équipe a déjà mis en ligne.
- Une ligne dont la référence est introuvable ou ambiguë n'est pas créée. Le kit est quand même importé.
- Copies doubles (`A-CREER-03`) : si le produit existe, son prix de vente doit être 1 800 et son prix d'achat 1 300. S'il n'existe pas, crée-le masqué dans `Cahiers & papeterie` avec ces prix et signale qu'il lui faut une photo.
- Ne modifie le prix d'aucun autre produit.
- Mets à jour `import-kits/rapport-resolution.md` avec les 147 références.

## Vérifier

1. Après import : 63 kits exactement (21 par gamme). Aucun kit Première S ou Terminale S sans S1 ni S2. Les 9 kits STEG sont présents.
2. Relance l'import une deuxième fois : toujours 63 kits, aucun doublon, et aucun kit déjà publié n'est repassé en masqué.
3. Première S1 Confort et Première S2 Confort : les livres de maths de Korka sont différents (Cracks en maths pour S1, La Clé des Cracks pour S2) et le livre de physique-chimie est le même. Terminale S2 Confort a en plus Physique Chimie TS2. Les Confort de Terminale L, S1 et S2 ont Philosophie L'Essentiel. 
4. 3e Essentiel : le taille-crayon est le Maped à réservoir, aucune boîte à éponge, aucun protège-cahier. 3e Complet : 8 protège-cahiers petit format et 5 grand format (si le produit existe). 3e Complet : pas de manuel, pas de Casio fx-92, calculatrice générique présente. 3e Confort : manuels et Casio fx-92 présents, calculatrice générique absente.
5. Terminale STEG Confort : Casio fx-92, stylo 4 couleurs et correcteur présents.
6. Le mot « ebook » n'apparaît sur aucune page publique.
7. Le lycée arabe affiche son message en petit texte, sans cadre ni prix. La STEG n'affiche plus aucun message « pas encore disponible ».
8. Change le prix d'un produit présent dans beaucoup de kits (le pack de stylos `SAC-066`, par exemple) : tous les kits concernés changent, puis remets l'ancien prix.
9. `prix_achat`, `source_interne` et `manquants_connus` n'apparaissent dans aucune réponse publique.
10. Build et tests existants au vert.

## Compte rendu

Termine par un résumé court :

- les fichiers modifiés et la commande pour relancer l'import ;
- les kits supprimés, créés et mis à jour ;
- les livres Korka rattachés, introuvables, ou encore masqués ;
- **la liste des produits masqués utilisés par les kits**, que l'équipe doit publier pour que les kits soient complets ;
- tout ce que tu as dû deviner ou laisser de côté.
