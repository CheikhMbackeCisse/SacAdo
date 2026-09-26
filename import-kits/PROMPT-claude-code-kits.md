# Intégration des kits scolaires SacAdo

Ajoute les kits scolaires dans l'application : 63 kits, 21 classes du CI à la Terminale (séries L, S, S1, S2 et STEG), 3 gammes par classe. Tout est dans le dossier `import-kits/` à la racine du dépôt :

- `kits.json` : les 63 kits, leurs lignes, les 146 références produits qu'ils utilisent, et les séries à venir
- `SacAdo_kits_v10.xlsx` : la même chose en tableur, pour l'équipe. Ne l'utilise pas pour l'import.

Les kits sont déjà composés : chaque produit, chaque quantité, chaque section et ce qui est coché ont été décidés et validés côté SacAdo. Ton travail est de les rattacher aux produits de l'application et de les afficher. Ne change pas leur composition : pas de ligne ajoutée, retirée ou remplacée par un produit « équivalent ». Une référence introuvable se signale, elle ne se remplace pas.

## Le principe, non négociable

Un kit ne stocke jamais de prix. Un kit est une liste de produits de l'application, chacun avec une quantité. Son prix est la somme `quantité x prix de vente actuel` des lignes cochées.

Quand l'équipe change le prix d'un produit dans l'application, tous les kits qui le contiennent doivent afficher le nouveau prix, sans aucune action sur les kits. C'est la raison de cette intégration : les prix vont encore bouger dans les jours qui viennent, et les kits servent déjà au marketing.

Les champs `prix_vente_classeur` et `prix_achat_classeur` de `kits.json` servent uniquement à repérer un mauvais rattachement (un cahier à 500 F rattaché à un produit à 9 000 F). Ne les enregistre nulle part.

## Les gammes

- `essentiel` : les fournitures de la liste, au prix le plus bas. Les livres au programme sont proposés en dessous, décochés.
- `complet` : toute la liste, fournitures de qualité supérieure et œuvres au programme (manuels Didactikos au primaire).
- `confort` : le Complet, plus les manuels scolaires, la Casio fx-92 et des livres en plus (lectures conseillées, ou les livres d'entraînement de Korka Diallo pour les classes scientifiques).

En Première et en Terminale, la série S est séparée en **S1** et **S2** : ce sont des kits distincts. Les livres de maths de Korka Diallo ne sont pas les mêmes en S1 et en S2. Ne rattache jamais une édition S2 à une référence S1, ni l'inverse.

S1 et S2 ont les mêmes matières, avec des horaires et des coefficients différents : leurs fournitures sont identiques, c'est normal. La différence est dans les livres.

Libellés affichés : Essentiel, Complet, Confort, dans cet ordre (`ordre_gamme` 1, 2, 3). N'écris jamais « bas de gamme » ni « premier prix ».

## Étape 1 : explorer avant de toucher au code

Ne modifie rien pendant cette étape.

1. Trouve comment un produit est identifié. Les références de `kits.json` viennent des fichiers d'import : `SAC-xxx` (catalogue Papex), `Sxxx` (LPD), `LIT-xxx`, `NIO-xxx`, `DID-xxx` (livres), `CIS-ardoise` (Cissé & Frères). Regarde si ces références sont stockées dans un champ (référence d'origine, SKU, slug, champ fournisseur...).
2. Résous chacune des 146 entrées de `references` vers un produit de l'application, dans cet ordre : par référence d'origine, puis par slug, puis par nom exact et fournisseur. Certaines entrées ont un champ `recherche` : suis ses consignes. Écris le résultat dans `import-kits/rapport-resolution.md`, un tableau avec : référence, nom attendu, produit trouvé (id, nom, prix actuel, statut), méthode, et un drapeau si le prix actuel s'écarte de plus de 50 % de `prix_vente_classeur`. Si une référence correspond à plusieurs produits, ne choisis pas : note-la « ambiguë ».
3. Regarde s'il existe déjà une notion de kit, pack ou bundle. La catégorie `Kits scolaires` existe dans l'application mais ne contient aucun produit.
4. Regarde comment fonctionnent le panier et les lignes de commande, où est stocké le prix d'achat, et comment est géré le champ `statut` (`masque`, `disponible`, `rupture`).
5. Regarde s'il y a du cache (ISR, cache de requêtes, pages statiques) qui pourrait afficher un prix de kit périmé.

Montre-moi ensuite un plan court : le modèle de données, les fichiers créés ou modifiés, la façon dont le prix est calculé et où, la façon dont le cache est invalidé, et le résumé du rapport de résolution (combien trouvées, ambiguës, introuvables). Attends mon accord avant l'étape 2.

## Étape 2 : modèle de données

Si l'application a déjà un mécanisme de pack qui respecte le principe ci-dessus, réutilise-le. Sinon, crée deux entités (noms à adapter aux conventions du projet) :

**Kit** : `slug` (unique), `titre`, `classe`, `cycle` (`elementaire`, `college`, `lycee`), `serie` (`L`, `S`, `S1`, `S2`, `STEG` ou vide), `gamme`, `ordre_gamme`, `description`, `description_si_aucune_cle_des_cracks`, `type_source`, `statut` (`masque` par défaut), plus deux champs réservés à l'admin : `source_interne` et `manquants_connus`.

**Ligne de kit** : `kit`, `produit` (clé étrangère vers le produit), `quantite`, `libelle_besoin`, `groupe_affichage`, `section` (`principal`, `livres_proposes`, `option`), `coche_defaut`, `ordre`.

Aucun champ prix, ni sur le kit, ni sur la ligne. Si le mécanisme existant impose un prix stocké sur le kit, il doit être recalculé automatiquement à chaque changement de prix ou de statut d'un produit contenu. Dis-moi lequel des deux tu choisis et pourquoi.

Écris une seule fonction de calcul du prix d'un kit, utilisée partout : page du kit, listes, panier, admin, balises de partage. Pas de calcul dupliqué.

## Étape 3 : importer

- Script réutilisable, par exemple `scripts/import-kits.*` dans le langage du projet.
- Idempotent : upsert sur le `slug` du kit. À chaque lancement, les lignes d'un kit sont remplacées par celles du fichier. Relancer ne crée pas de doublon.
- Les kits nouveaux sont créés en `statut = masque`. La publication est une action manuelle. Quand tu relances l'import, les kits existants gardent leur statut : ne dépublie jamais un kit déjà en ligne.
- Si un kit dont le slug figure dans `slugs_supprimes` existe (anciennes versions : Première S et Terminale S non séparées), supprime-le avec ses lignes.
- Une ligne dont la référence est introuvable ou ambiguë n'est pas créée. Le kit est quand même importé. Note chaque ligne ignorée dans le rapport.
- Ne crée aucun produit, avec une seule exception : les copies doubles (référence `A-CREER-03`). Si un produit « copies doubles » existe, mets son prix de vente à 1 800 et son prix d'achat à 1 300. S'il n'existe pas, crée-le masqué dans `Cahiers & papeterie` avec ces prix, et signale qu'il lui faut une photo.
- Ne modifie le prix d'aucun autre produit.
- Produits à variantes (ardoise Cissé, crayons LPD) : pas de choix de couleur dans un kit. Utilise la variante par défaut. Pour le crayon `S065`, c'est la variante vendue à l'unité, pas le pack de 12.

## Étape 4 : affichage

**Page d'une classe.** Les trois gammes côte à côte, dans l'ordre Essentiel, Complet, Confort, avec leur prix calculé.

**Page d'un kit** (URL partageable, par exemple `/kits/<slug>`) :

- Chaque ligne affiche une case à cocher, le nom du produit avec un lien vers sa fiche, la quantité et le prix unitaire actuel. Le client peut décocher n'importe quelle ligne, et le prix du kit se met à jour tout de suite.
- Les lignes du groupe `Cahiers` sont regroupées en une seule ligne « X cahiers », où X est la somme des quantités. Un clic l'ouvre et montre le détail par `libelle_besoin` (par exemple « Maths (cours) : 200 p grand format »).
- Section `livres_proposes`, uniquement dans les kits Essentiel : affichée sous le kit, titre « Livres au programme, non inclus », lignes décochées. Les cocher ajoute leur prix.
- Section `option` : le sac, décoché, en bas.
- Aucune mention d'ebook, offert ou payant : les ebooks ne sont pas encore prêts.
- Une ligne dont le produit est `masque`, en `rupture` ou sans prix de vente n'est ni affichée ni comptée. Un kit sans aucune ligne principale affichable n'est pas affiché.
- Si un kit a des lignes de livres Korka Diallo (références `CDC-...`) et qu'aucune n'est affichable, affiche `description_si_aucune_cle_des_cracks` à la place de `description`. On n'annonce jamais un livre qui n'est pas dans le kit.
- Le prix affiché est la somme exacte des lignes cochées. Pas de prix barré, pas de pourcentage d'économie : le kit coûte le même prix que ses produits achetés séparément.
- Visuel du kit : ne génère aucune image de produit. Utilise une mosaïque d'au plus 4 photos déjà publiées des produits du kit, ou une carte texte avec le nom de la classe et de la gamme.
- `prix_achat`, `source_interne` et `manquants_connus` ne doivent jamais apparaître côté client : ni page, ni API publique, ni HTML.

**Panier.** Ajouter un kit ajoute chaque produit coché comme une ligne de panier normale, avec sa quantité (fusionnée si le produit est déjà au panier). Garde le `slug` du kit sur ces lignes pour les statistiques, si le modèle le permet. Le prix d'achat reste figé sur la ligne de commande au moment de la vente, comme pour tout produit.

**Cache.** Quand le prix ou le statut d'un produit change, les pages et caches des kits qui le contiennent doivent être invalidés.

**Séries à venir.** `series_a_venir` ne contient plus que le lycée arabe (profils scientifique S1A/S2A et littéraire LA/L-AR), en Seconde, Première et Terminale. Là où l'utilisateur choisit sa série, affiche-le avec son `message` (« Les kits du lycée arabe ne sont pas encore disponibles. ») : un petit texte simple sous le nom de la série, dans le style du texte courant. Pas de cadre, pas de carte, pas d'encadré, pas de fond coloré, pas d'icône d'alerte. Pas de prix, pas de bouton d'achat, pas de date, pas de lien vers un kit. Aucune autre série technique n'est affichée.

**Admin.** Une liste des kits avec, pour chacun : prix calculé, nombre de lignes affichées sur le total, et la liste des lignes cachées avec leur motif (produit masqué, rupture, sans prix, référence introuvable). Et une action pour publier ou masquer un kit.

## Étape 5 : vérifier

1. Lance l'import deux fois : toujours 63 kits (21 par gamme, dont 9 STEG), aucun doublon, aucun kit Première S ou Terminale S sans S1 ni S2.
2. Propagation : change le prix d'un produit présent dans beaucoup de kits (le pack de 4 stylos `SAC-066`, par exemple). Vérifie que le prix de chaque kit concerné change, sur la page du kit, dans la liste et dans l'admin. Remets ensuite l'ancien prix.
3. Masque un produit contenu dans un kit : il disparaît du kit et le prix baisse d'autant. Remets-le.
4. Page d'un kit : décocher une ligne fait baisser le prix, le groupe Cahiers s'ouvre, les livres proposés de l'Essentiel et le sac sont décochés au départ.
5. `prix_achat` n'apparaît dans aucune réponse publique. Le mot « ebook » n'apparaît sur aucune page de kit.
6. Le lycée arabe s'affiche avec son message en petit texte simple, sans cadre, sans prix ni bouton d'achat. La STEG a ses kits comme les autres séries.
7. Chaque référence `CDC-...-S1` ou `CDC-...-S2` est rattachée à l'édition de la bonne série.
8. Lance le build et les tests existants. Corrige ce que ton changement a cassé.

## Compte rendu

Termine par un résumé court :

- les fichiers créés ou modifiés, et la commande pour relancer l'import ;
- le nombre de références trouvées, ambiguës et introuvables, avec la liste des deux dernières ;
- **la liste des produits masqués utilisés par les kits**, que l'équipe devra publier pour que les kits soient complets ;
- les kits dont le prix calculé s'écarte beaucoup du classeur, à cause d'un produit dont le prix de l'app diffère ;
- tout ce que tu as dû deviner ou laisser de côté.
