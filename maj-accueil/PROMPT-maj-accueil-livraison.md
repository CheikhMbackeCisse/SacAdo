# Mise à jour SacAdo : accueil, catégories, paramètres, logos, livraison

À faire après `PROMPT-maj-catalogue-26-09.md`, `PROMPT-livres-korka-recherche.md` et la correction des kits v10. Quand une consigne ici contredit une consigne précédente, c'est celle-ci qui compte.

Les consignes sont validées : applique-les sans attendre mon accord. Fais d'abord une sauvegarde des tables produits, catégories et paramètres dans `maj-accueil/sauvegarde/`.

Fichiers fournis dans `maj-accueil/images/`, à la racine du dépôt, déjà optimisés en WebP :

- `categories/fournitures-scolaires.webp` : nouvelle photo de la catégorie Fournitures scolaires ;
- `marques/maped.webp` et `marques/schneider.webp` : nouveaux logos, à la place des précédents ;
- `app/logo-entete-96.webp` et `app/logo-entete-192.webp` : logo SacAdo sur fond bleu pour l'en-tête.

## 1. Catégories

- **Supprime la catégorie « Marques ».** Elle ne doit apparaître ni dans la liste des catégories, ni sur l'accueil. Les pages de marque (`/marques/<slug>`) restent : on y arrive par la recherche (« maped ») et en touchant le logo ou le nom de la marque sur une fiche produit.
- **Fournitures scolaires et Imprimerie échangent leurs places** dans l'ordre des catégories, sur l'accueil et sur la page Catégories. « Fournitures d'école » et « Fournitures scolaires » sont la même catégorie.
- **Écriture et Mobilier échangent leurs places** de la même façon.
- **Nouvelle photo** pour Fournitures scolaires : `categories/fournitures-scolaires.webp`.

## 2. Paramètres

Dans Paramètres, la zone actuelle « Trouver un produit avec une photo » est remplacée par deux éléments :

1. **Dans le cadre** : « Rechercher un produit ». C'est un champ de recherche texte, qui utilise la même recherche que la barre principale (synonymes compris).
2. **En dessous, hors du cadre** : le texte « Donnez-nous votre liste de fournitures et on s'occupe du reste », suivi d'un bouton d'envoi. Le client envoie une photo **ou** un fichier (JPG, PNG, WebP, HEIC, PDF, Word, Excel ; 10 Mo maximum), plus un champ classe et un numéro WhatsApp, tous deux facultatifs. La demande est enregistrée dans `demandes_produit` avec le type « liste de fournitures » et le fichier joint, et apparaît dans l'admin.

Le bouton « Envoyer ma liste de fournitures » de la page des kits accepte lui aussi les photos **et** les fichiers.

## 3. Logos

- **Logo de l'app.** En haut à gauche de la page d'accueil, et partout où l'en-tête affiche le logo, le logo sur fond blanc est remplacé par le logo sur fond bleu (`app/logo-entete-96.webp`, et `logo-entete-192.webp` pour les écrans haute densité). Garde la hauteur actuelle de l'en-tête.
- **Logos de marques.** Remplace les logos Maped et Schneider par les nouveaux fichiers. Agrandis les logos affichés à côté du nom des produits : environ 24 px de haut sur les cartes produit, et 36 px sur la fiche produit. Ils doivent se lire sans effort, parce qu'ils servent à justifier un prix de marque. Ils ne doivent pas faire passer le nom du produit sur trois lignes : si la place manque sur la carte, mets le logo au-dessus du nom plutôt qu'à côté.

## 4. Prix

| Produit | Nouveau prix de vente |
|---|---|
| Kit de traçage Maped (actuellement 900 F) | 1 500 F |
| Kit de traçage Maped Nightfall | 1 500 F |
| Cartable bleu et mauve motif lapin (actuellement 7 470 F) | 7 500 F |

Retrouve chaque produit par son nom. Si plusieurs produits ou aucun ne correspondent, ne devine pas : note-le dans le rapport. Les kits qui contiennent ces produits se mettent à jour tout seuls, puisque leur prix est calculé.

## 5. Accueil : produits mis en avant

- **Mise en avant gérée depuis l'admin.** Ajoute un champ « mis en avant sur l'accueil » avec un ordre, que l'équipe pourra changer sans toi. Remplis-le avec la liste ci-dessous. Si un produit n'est pas trouvé, ou si son prix actuel diffère de celui indiqué, ne change pas le prix : signale-le.

  1. Trousse Hello bleue
  2. Cahier Calligraphe 180 pages petit format (1 600 F)
  3. Post-it 5 blocs (1 800 F)
  4. Kit de traçage Maped (1 500 F)
  5. Kit de traçage Maped Nightfall (1 500 F)
  6. Gourde graduée motivationnelle orange
  7. Cartable rigide bleu marine
  8. Cartable bleu et mauve motif lapin (7 500 F)
  9. Un sac Eastpak (le moins cher publié)
  10. Un livre de Korka Diallo (Mathématiques 3e)
  11. Le livre « 4 cahiers magiques »
  12. Une si longue lettre
  13. L'Étranger
  14. L'Os de Mor Lam
  15. Ami et Rémi

- **Le reste de l'accueil**, après ces produits, montre surtout des produits de rentrée : fournitures scolaires, cahiers et papeterie, écriture, trousses, sacs et cartables, gourdes et boîtes à goûter, livres et annales, kits. Garde la règle de variété du prompt précédent (pas plus de 2 produits consécutifs du même éditeur, de la même marque ou de la même sous-catégorie).
- **La tech, moins souvent.** Tablettes, clés USB, imprimantes, plastifieuses et ordinateurs peuvent apparaître, mais au plus 1 produit sur 8 dans le flux de l'accueil. Les ordinateurs à 175 000 F ou plus n'apparaissent jamais sur l'accueil (ils restent dans leur catégorie et dans la recherche). Aucune section de l'accueil n'est consacrée aux ordinateurs.

## 6. Chargement continu

Sur l'accueil, dans chaque catégorie, dans les résultats de recherche et dans l'onglet Moi (et partout où une liste de produits s'affiche), les produits suivants se chargent automatiquement quand on arrive en bas. Pas de fin de page tant qu'il reste des produits. Quand il n'y en a plus, le message « Vous ne trouvez pas ce que vous cherchez ? Demandez-le-nous » du prompt précédent s'affiche. Garde un bouton « Charger plus » seulement en secours, si le chargement automatique échoue.

## 7. Livraison

Le modèle « livraison 24 h / livraison 6 jours » est remplacé par deux options, comme chez Jumia. **Les prix de livraison sont déjà dans l'app : ne les modifie pas.**

1. **Livraison express, en moins de 24 h.** C'est l'ancienne option 24 h, renommée « Livraison express (moins de 24 h) », avec son prix actuel.
2. **Livraison à une date donnée.** Elle remplace l'ancienne option 6 jours, avec le prix actuel de cette option. La date est calculée ainsi :
   - commande passée du lundi au samedi : livraison le **dimanche** qui suit ;
   - commande passée le dimanche : livraison le **samedi** qui suit.

   Exemples : une commande du mercredi 30 septembre est livrée le 4 octobre ; une commande du dimanche 4 octobre est livrée le 10 octobre.

Retire toute mention de « 6 jours » : panier, paiement, fiches produit, e-mails et messages, page d'aide, admin.

**Réglages dans l'admin**, sans toucher au code :

- l'heure limite du samedi, au-delà de laquelle une commande passe au samedi suivant (par défaut : aucune, toute commande du samedi est livrée le dimanche) ;
- une liste de dates fermées (jours fériés, Magal, Tabaski...) : si la date calculée est fermée, prends la prochaine date de livraison ouverte, samedi ou dimanche.

**Affichage.** Le client ne voit jamais « dimanche », « samedi », « le week-end » ni « à date fixe » : il voit la date. Au paiement, l'option s'intitule directement « Livraison le 4 octobre », avec la date calculée pour sa commande, à côté de « Livraison express (moins de 24 h) ». La même date apparaît dans la confirmation de commande, dans le suivi, dans les messages au client et dans l'admin. Dans l'admin, les commandes se filtrent par date de livraison, pour préparer la tournée, et les commandes express sont signalées à part.

## Vérifier

1. La catégorie Marques n'existe plus, et la page Maped reste accessible par la recherche et depuis une fiche produit.
2. L'ordre des catégories montre Fournitures scolaires à l'ancienne place d'Imprimerie, et Écriture à l'ancienne place de Mobilier (et inversement), sur l'accueil et sur la page Catégories. La nouvelle photo de Fournitures scolaires s'affiche.
3. Paramètres : le cadre contient la recherche ; en dessous, l'envoi de liste accepte une photo et un PDF, et la demande apparaît dans l'admin avec son fichier.
4. Les nouveaux logos Maped et Schneider sont visibles et lisibles sur une carte produit et sur une fiche.
5. Le logo sur fond bleu est en haut à gauche de l'accueil.
6. Les trois prix de la section 4 sont à jour, y compris dans les kits qui contiennent ces produits.
7. L'accueil commence par les produits mis en avant, aucun ordinateur à 175 000 F ou plus n'y apparaît, et la tech reste rare dans le flux.
8. Sur l'accueil, dans une catégorie et dans Moi, descendre en bas charge d'autres produits.
9. Livraison : au paiement, les deux options s'affichent avec leurs prix actuels (inchangés). Une commande simulée le mercredi 30 septembre affiche « Livraison le 4 octobre », et une commande simulée le dimanche 4 octobre affiche « Livraison le 10 octobre ». Côté client, aucun libellé ne dit « dimanche », « samedi » ou « week-end » à la place de la date. Une date fermée est bien sautée. Il ne reste nulle part « 6 jours ».
10. Le build et les tests passent.

## Compte rendu

Écris-le dans `maj-accueil/rapport.md` : ce qui est fait, les produits non trouvés ou dont le prix diffère, et ce qui reste à faire.
