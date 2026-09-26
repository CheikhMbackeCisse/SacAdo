# Mise à jour SacAdo du 26/09 : catalogue, catégories, recherche, accueil, navigation

Tout doit être fini aujourd'hui. Les consignes ci-dessous sont validées : applique-les sans attendre mon accord, sauf là où c'est écrit « demande avant ».

Fichiers fournis, dans le dossier `maj-26-09/` à la racine du dépôt :

- `images/produits/` : 14 photos produits, déjà converties en WebP et redimensionnées ;
- `images/marques/` : logos Maped, Giotto, Schneider, Clairefontaine ;
- `images/app/` : le logo SacAdo sur fond bleu, décliné en icônes (512, 192, 180, 32, 16, favicon.ico, version maskable) ;
- `import-kits/` : les kits en version 9 et leur prompt de correction.

## Règles générales

- **Sauvegarde d'abord.** Avant de modifier la moindre donnée, exporte les tables produits, catégories et kits dans `maj-26-09/sauvegarde/`.
- **Retrouver un produit.** Cherche-le par son nom (sans tenir compte des accents ni de la casse) et par son fournisseur. Si plusieurs produits correspondent, ou aucun, ne devine pas : note-le dans le rapport et passe au suivant.
- **Supprimer un produit.** S'il apparaît dans une commande ou un kit, fais une suppression logique (retiré du catalogue, historique conservé). Sinon, supprime-le vraiment. Dans les deux cas, liste-le dans le rapport.
- **Ne change aucun prix d'achat**, sauf mention contraire. Ne génère aucune image de produit.

## 1. Corrections produit par produit

| Produit (tel que nommé dans l'app) | Action |
|---|---|
| Règle plastique | Prix de vente 300 → 100 |
| Cahier spirale 8 sujets A4 | Prix de vente 6 600 → 5 500 |
| Cahier spirale orange | Prix de vente 6 600 → 5 500 |
| Calculatrice Casio fx-92 | Prix de vente 9 000 → 8 000 |
| Calculatrice TI-83 | Remplace sa première image par `calculatrice-ti-83-premium-ce-python-1.webp` (image principale) et `calculatrice-ti-83-premium-ce-python-2.webp`. Garde ses autres images s'il en a |
| Boîte à goûter ronde avec gourde | Doublon avec deux images différentes : fusionne en un seul produit avec les deux images en galerie. Garde celui qui a des commandes ou des lignes de kit, redirige l'autre URL |
| Boîte à goûter rose avec gourde (3 500 F, sans photo) | Supprimer |
| Bouteille isotherme vacuum cup (toute la gamme) | Supprimer |
| Gourde inox noir sport | Prix de vente 3 100 → 2 800 |
| Gourde sport spray brumisateur | Prix de vente 3 100 → 2 800 |
| Brosse tableau magnétique | Prix de vente 280 → 400 |
| Marqueur tableau blanc vert | Prix de vente 4 000 → 500 |
| Présentoir correcteur Igle correction pen | Renommer « Stylo correcteur Blanco Igle », prix de vente 400 |
| Porte-mines métal (lot) | Vendu à l'unité : retire « lot » du nom, prix de vente 700 |
| Stylo Stitch | Prix de vente 3 000 |
| Taille-crayon rond | Ce n'est pas un taille-crayon : renommer « Boîte à éponge », catégorie Fournitures scolaires |
| Modem routeur 4G LTE (25 000 F) | Remplace son image par `modem-routeur-4g-lte.webp` |
| Bloc-notes pupitre 160 pages | Prix de vente → 5 000 |
| Cahier de dessin (1 050 F) | Prix de vente 1 050 → 550 |
| Cahier Prestige B5 500 pages | Prix de vente 4 100 → 4 000 |
| Cahiers Socamel sans image | Supprimer |
| Protège-cahiers couleurs | Vendus à l'unité, prix de vente 150 |
| De Tilène au Plateau | Remplace son image par `de-tilene-au-plateau.webp` |
| Découverte du monde CI (Didactikos) | Ajoute l'image `decouverte-du-monde-ci.webp` |

## 2. Stylos : à l'unité, plus de lots

- **Staedtler Stick 430 M.** Supprime les produits Staedtler vendus en lot, en boîte ou en paquet. Crée à la place « Stylo à bille Staedtler Stick 430 M », 100 F l'unité, en quatre couleurs : bleu, noir, rouge, vert. Utilise les variantes de couleur si l'app en a, sinon quatre produits. Chaque couleur a sa photo `stylo-staedtler-stick-430-<couleur>.webp`. Crée aussi « Pack de 4 stylos Staedtler Stick 430 M (bleu, rouge, noir, vert) » à 400 F, photo `pack-4-stylos-staedtler-stick-430.webp`.
- **Bic Cristal.** Crée « Stylo à bille Bic Cristal », 100 F l'unité, en bleu, noir, rouge, vert, même principe, photos `stylo-bic-cristal-<couleur>.webp`. Supprime les Bic vendus en lot.
- Pour ces nouveaux produits, prix d'achat vide et fournisseur « à préciser » si tu ne le trouves pas.
- **Pour l'instant, ne supprime aucun autre produit vendu en lot** : surligneurs, feutres, crayons de couleur et le reste restent en l'état.

## 3. Règles de nommage sur tout le catalogue

- **« Présentoir ».** SacAdo vend à l'unité, jamais en gros, même quand la photo montre un présentoir. Retire « présentoir » et « (lot) » des noms et descriptions des produits vendus à l'unité. Si un prix ressemble à un prix de boîte (plus de 1 000 F pour un stylo, un crayon ou une gomme, par exemple), ne le change pas : liste-le dans le rapport.
- **Formats de cahier.** Remplace « 24x32 » (et 24 x 32, 24×32) par « grand format », et « 17x22 » (et variantes) par « petit format », dans les noms, descriptions et filtres. Les autres formats (A4, B5, 21x29,7...) ne changent pas.
- **Entités HTML.** Des noms affichent « cahier d&rsquo;activités ». Décode toutes les entités HTML (`&rsquo;`, `&amp;`, `&eacute;`...) dans les noms et descriptions de tous les produits, et corrige les scripts d'import pour que ça ne revienne pas.
- **Post-it.** Les produits appelés « bloc notes » qui sont en réalité des notes adhésives repositionnables s'appellent désormais « Post-it » (par exemple « Post-it 76 x 76 mm jaune »). Ajoute-les aussi au filtre Étiquettes. Ne touche pas aux vrais blocs-notes (bloc pupitre, bloc à spirale...).

## 4. Marques et collections

- **Champ marque.** Ajoute un champ `marque` aux produits et remplis-le à partir des noms : Maped, Giotto, Clairefontaine, Calligraphe, Schneider, Staedtler, Bic, Casio, Texas Instruments, Stabilo, Pelikan, Faber-Castell, Exacompta, Esselte... Liste dans le rapport les produits dont la marque est incertaine. Pour les livres, l'éditeur n'est pas la marque : garde-le dans son champ.
- **Pages marques.** Chaque marque a sa page (`/marques/<slug>`) avec tous ses produits et leurs prix. Une page « Marques » les liste toutes. Taper « maped » ou « giotto » dans la recherche propose la page de la marque en premier. Ajoute un accès à la page Marques dans la navigation des catégories.
- **Logos.** Pour Maped, Giotto, Schneider et Clairefontaine, affiche le logo (`images/marques/`) en petit à côté du nom du produit : sur la carte produit et sur la fiche. Le but est de montrer que le prix correspond à la marque. Les autres marques n'ont pas de logo pour l'instant : affiche seulement leur nom, et ne mets jamais le logo d'une autre marque (Calligraphe n'a pas le logo Clairefontaine).
- **Collections.** Ajoute un champ `collection` aux livres et affiche-le sur la carte et la fiche (« Collection La Clé des Cracks »). Remplis-le quand le titre ou la fiche l'indique : La Clé des Cracks, Excellence, Bled, VISA Annales, Petits Classiques Larousse, Folio... Par exemple, le livre de SVT 3e de Korka Diallo porte « Collection La Clé des Cracks ». Liste les cas incertains dans le rapport.

## 5. Catégories

- Les calculatrices vont dans **Fournitures scolaires**.
- Tous les produits de **Matériel géométrique** passent dans Fournitures scolaires, avec un filtre « Géométrie » pour les retrouver. La catégorie Matériel géométrique disparaît des listes, et Fournitures scolaires prend sa place dans l'ordre d'affichage (page d'accueil et page Catégories). Si l'app a à la fois « Fournitures scolaires » et « Fournitures d'école », c'est la même catégorie : fusionne-les et dis-moi le nom que tu gardes.
- Les **bâtonnets** et les **craies** vont dans Fournitures scolaires, pas dans Art & dessin.
- Aucun **cahier** ne reste dans Art & dessin : ils vont dans la catégorie des cahiers.
- **Les livres ne sont jamais dans Fournitures.** Tout livre rangé dans une catégorie de fournitures passe dans Livres.
- **Audit Papex, LPD et Cissé & Frères.** Vérifie la catégorie de chacun de leurs produits. Applique les déplacements évidents (un cahier dans Cahiers, une calculatrice dans Fournitures scolaires...). Liste les cas douteux dans le rapport sans les déplacer.

## 6. Recherche et filtres

- **Bug de filtrage.** Avec les filtres « 3e » + « SVT », aucun résultat ne s'affiche ; le livre n'apparaît qu'après « Charger plus ». Le filtre ne porte donc que sur les produits déjà chargés. Les filtres et la recherche doivent interroger tout le catalogue côté serveur. « Charger plus » ne fait que paginer les résultats déjà filtrés, et le nombre de résultats affiché est le vrai total. Corrige ça pour toutes les catégories.
- **Matière Français.** Ajoute « Français » aux filtres de matière des livres. Donne-la aux œuvres littéraires, aux manuels de français, aux grammaires, conjugaisons et Bled.
- **Synonymes.** Recherche et filtres ignorent les accents, la casse, les pluriels et les tirets, et reconnaissent au moins ces équivalences :

| Terme | Équivalents |
|---|---|
| Classes | CI, cours d'initiation · CP, cours préparatoire · CE1, CE2, CM1, CM2 · 6e, 6ème, 6eme, sixième · 5e, 5ème, cinquième · 4e, 4ème, quatrième · 3e, 3ème, troisième · Seconde, 2nde, 2de, 2nd · Première, 1re, 1ère, 1ere · Terminale, Tle, Term · S1, S2, L, L2, STEG, série G |
| Matières | Maths, mathématiques, math · Français, francais, lecture, grammaire, conjugaison · SVT, sciences de la vie et de la terre, biologie, sciences naturelles · PC, physique, chimie, physique-chimie, sciences physiques · HG, histoire, géographie, histoire-géo · Anglais, English · Espagnol · Arabe · Philosophie, philo · Éducation civique, EC, ECM · Découverte du monde, DDM · Langue et communication, LC · SES, économie |
| Produits | stylo, bic, stylo à bille · crayon, crayon papier, crayon noir, crayon à papier · taille-crayon, taille crayon · kit géométrie, matériel géométrique, boîte de géométrie, compas, équerre, rapporteur · calculatrice, calculette · protège-cahier, couverture de cahier · post-it, notes adhésives, pense-bête · correcteur, blanco, typex · surligneur, fluo, stabilo · feutre, marqueur · colle, bâton de colle · sac, cartable, sac à dos · copies doubles, feuilles doubles · cahier grand format, grand cahier · cahier petit format, petit cahier |

- **Produits masqués.** Ils restent masqués, n'en publie aucun. Mais liste dans le rapport tous les livres La Clé des Cracks (Korka Diallo) masqués, avec la raison (pas d'image, pas de prix...) : je décide ensuite.
- **Prix.** Remets le filtre de prix dans les pages de catégorie.

## 7. Page d'accueil

- **Rentrée d'abord.** Les ordinateurs ne sont plus en haut de l'accueil. En tête : kits, fournitures scolaires, cahiers, livres. Les ordinateurs descendent, en commençant par les moins chers.
- **Plus de variété.** Aujourd'hui, une section ne montre que des livres de Korka et une autre que des Didactikos. Dans chaque section et dans les listes « pour vous », pas plus de 2 produits consécutifs du même éditeur, de la même marque ou de la même sous-catégorie. Et pas plus de 30 % d'une section pour un même éditeur ou une même marque.

## 8. Navigation et petites fonctions

- **Mentions légales.** Le bloc mentions légales, CGV et autres, en bas de chaque page, disparaît partout. Ces liens restent uniquement dans Paramètres.
- **Fin de liste.** En bas d'une liste, les produits suivants se chargent tout seuls. Quand il n'y en a plus, affiche : « Vous ne trouvez pas ce que vous cherchez ? Demandez-le-nous. » Ça ouvre un formulaire court : ce que le client cherche, une photo facultative, et un numéro WhatsApp facultatif. Les demandes sont enregistrées dans une table `demandes_produit` et listées dans l'admin, avec la date, le statut (nouvelle, traitée) et la photo.
- **Recherche par photo.** Dans Paramètres, remplace le badge de recherche de produit par « Trouver un produit avec une photo ». Il ouvre le même formulaire, photo obligatoire, avec le type « photo produit ». Pas d'IA : c'est l'équipe qui répond.
- **Envoyer sa liste.** Sur la page des kits, ajoute « Envoyer ma liste de fournitures ». Même formulaire, photo de la liste obligatoire, champ classe facultatif, type « liste de fournitures ». L'équipe compose ensuite le kit.
- **Zoom.** Le zoom par pincement et le double-tap sont désactivés dans toute l'app : `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">`, plus un blocage de `gesturestart` pour iOS. Tous les champs de saisie font au moins 16 px de police, pour qu'iOS ne zoome pas au focus.
- **Logo.** Le logo de l'app devient celui sur fond bleu. Remplace le favicon, les icônes du manifeste (192, 512, maskable), l'icône Apple (180), l'écran de démarrage s'il existe, et le logo de l'en-tête s'il utilise l'ancien. Fichiers dans `images/app/`.

## 9. Kits

- Applique `import-kits/PROMPT-correction-kits-v9.md` après les corrections de la section 1 (les prix des protège-cahiers et le renommage de la boîte à éponge doivent être faits avant). Par rapport à la version 7, deux changements : dans l'Essentiel du collège, du lycée et de la STEG, le taille-crayon est le Maped à réservoir (`SAC-017`), car l'ancien (`S030`) était une boîte à éponge ; et le Complet et le Confort de ces classes ont un protège-cahier par cahier, en petit et en grand format.
- **Kit indisponible.** Pour toute classe ou série sans kit (aujourd'hui le lycée arabe), un simple texte : « Le kit de cette classe n'est pas encore disponible. » Pas de cadre, pas de carte, pas d'icône.

## 10. Images

- Toutes les images, nouvelles et existantes, passent par la même optimisation : WebP, 1 200 px maximum sur le plus grand côté, qualité autour de 80, métadonnées supprimées, une vignette de 400 px pour les listes, chargement différé (`loading="lazy"`) hors écran. Si l'app n'a pas encore cette chaîne, ajoute-la et lance-la sur toutes les images existantes, en gardant les originaux de côté.
- Les fichiers de `maj-26-09/images/` sont déjà optimisés : ne les agrandis pas.

## 11. Rapports à produire

Dans `maj-26-09/rapports/` :

1. **`produits-sans-image.xlsx`** : tous les produits sans image, et ceux dont l'image vient de yuupee (URL contenant « yuupee »), car l'équipe leur cherche de nouvelles photos. Colonnes : nom, fournisseur, référence d'origine, catégorie, prix de vente, statut, image actuelle (URL ou vide), et terme de recherche d'image si l'import en a gardé un (champ, note ou fichier d'import). Trie par fournisseur puis par catégorie.
2. **`modifications.md`** : chaque correction de la section 1 (faite, ou non trouvée), les produits supprimés (suppression logique ou réelle), les produits créés, les déplacements de catégorie, les cas douteux, les prix qui ressemblent à des prix de boîte, les marques et collections incertaines, et les livres La Clé des Cracks masqués.

## Vérifier

1. Chaque prix de la section 1 est à jour sur la fiche, dans la liste et dans les kits qui contiennent le produit.
2. Filtres « 3e » + « SVT » : le livre de SVT 3e apparaît dès le premier affichage, et le nombre de résultats est correct.
3. Chercher « 3eme svt », « troisième svt », « post it » et « maped » donne des résultats.
4. Aucun nom de produit ne contient « & » suivi d'un code, « présentoir », « 24x32 » ni « 17x22 ».
5. La page Maped montre tous les produits Maped, et le logo Maped apparaît à côté de leur nom.
6. Il n'y a plus de mentions légales en bas des pages, et elles restent accessibles dans Paramètres.
7. Une demande envoyée depuis le formulaire (avec photo) apparaît dans l'admin.
8. Sur téléphone, le pincement ne zoome pas, et le focus sur un champ non plus.
9. La nouvelle icône apparaît quand on ajoute l'app à l'écran d'accueil.
10. Le build et les tests passent.

## Compte rendu

Termine par un résumé court : ce qui est fait, ce qui ne l'est pas et pourquoi, les produits non trouvés, et le chemin des deux rapports.
