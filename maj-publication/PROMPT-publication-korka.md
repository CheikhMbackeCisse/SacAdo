# Publication des produits en attente, nouveaux produits, contrôle du catalogue Korka

Les consignes sont validées : applique-les sans attendre mon accord. Fais d'abord une sauvegarde de la table produits dans `maj-publication/sauvegarde/`.

Fichiers fournis dans `maj-publication/`, à la racine du dépôt :

- `produits_non_publies_sacado.xlsx` : l'export des 146 produits non publiés (ID, nom, fournisseur, statut) ;
- `images/` : photos des trois nouveaux produits, déjà en WebP ;
- `korka/SacAdo_Livres_Korka_Diallo.xlsx` et `korka/TACHE_livres_korka_integration.md` : le catalogue Korka et ses règles d'import. Les photos sont dans `korka/photos_korka.zip`.

## 1. Publier les produits en attente

- **Publie les 92 produits au statut `en_attente`** de l'export : 59 Yuupee, 32 Seye Dynamique Technologie, et le paquet de copies doubles (ID 1716). Retrouve-les par leur ID.
- **Ne touche pas aux 21 produits `refuse`.**
- **Les 33 produits `archive` restent archivés.** Ce sont :
  - le produit de test « Cahier premium 96 pages — test vendeur » (ID 36) ;
  - les 31 produits SacAdo d'ID 1 à 34, sans fournisseur réel, avec des stocks qui semblent inventés, et dont certains doublonnent de vrais produits (par exemple « Calculatrice scientifique Casio FX-92 » à 12 000 F, alors que la vraie est à 8 000 F) ;
  - « Boite a gouter avec gourde » de LPD (ID 1182), sans doute archivée lors de la fusion des doublons de boîtes à goûter.

  Liste-les dans le rapport sans les publier. Je confirmerai.
- Avant de publier, nettoie les noms importés des sites fournisseurs : retire les restes de page web, comme « Roll over image to zoom in » au début de l'ID 1001, décode les entités HTML, et mets les noms entièrement en majuscules en casse normale. Ne change pas le sens du nom.
- La règle de l'accueil reste valable : les ordinateurs à 175 000 F ou plus n'y apparaissent pas, et la tech y reste rare.
- Publie même les produits sans image, mais liste-les dans le rapport pour que l'équipe leur trouve une photo.

## 2. Nouveaux produits

Vérifie d'abord qu'ils n'existent pas déjà (recherche par nom). S'ils existent, mets-les à jour au lieu d'en créer de nouveaux.

| Produit | Fournisseur | Prix de vente | Prix d'achat | Catégorie | Image |
|---|---|---|---|---|---|
| Pack Livre parlant 300+ mots + 4 cahiers magiques offerts | Korka Diallo | 12 900 F | 10 320 F | Livres et annales > Éveil et maternelle | `pack-livre-parlant-4-cahiers-magiques.webp` |
| Les 4 cahiers magiques (réutilisables, dès 3 ans) | Korka Diallo | 7 900 F | 6 320 F | Livres et annales > Éveil et maternelle | `4-cahiers-magiques.webp` |
| Calculatrice scientifique Casio fx-991ES Plus | à préciser | 4 750 F | 3 700 F | Fournitures scolaires | `calculatrice-casio-fx-991es-plus.webp` |

- **Les deux produits Korka** : le prix d'achat applique la remise Korka de 20 % sur le prix public. Mets `niveau` à Maternelle et `type_ouvrage` à « Cahier d'activités ». Marque du livre parlant : Leleyu. Description courte :
  - pour le pack : un livre sonore de 11 thèmes (lettres, chiffres, animaux, métiers...), avec 4 cahiers réutilisables (alphabet, chiffres, mathématiques, dessins) offerts ;
  - pour les cahiers : 4 cahiers réutilisables à effacer (alphabet, chiffres, mathématiques, dessins), pour les enfants dès 3 ans.
- **La Casio** : marque Casio, avec le logo Casio si l'app l'a, sinon le nom seul.
- Publie les trois produits.
- « Les 4 cahiers magiques » fait partie des produits mis en avant sur l'accueil (prompt précédent) : vérifie qu'il y apparaît.

## 3. Contrôle du catalogue Korka Diallo

Écris un script réutilisable, `scripts/verif-korka.*` dans le langage du projet. Il compare les 41 lignes de `korka/SacAdo_Livres_Korka_Diallo.xlsx` avec l'app et produit `maj-publication/rapports/verif-korka.md`.

**Rattachement.** Pour chaque ligne du tableur, cherche le produit du fournisseur Korka Diallo :

1. d'abord par `titre_fournisseur` (le titre exact du tableur) ;
2. puis par le titre normalisé (sans casse, sans accents, sans ponctuation) ;
3. puis par niveau + matière + auteur + édition (année).

**Classement de chaque ligne :**

- **Présent et conforme** : prix de vente = prix public, prix d'achat = prix public - 20 %, image principale présente, statut publié.
- **Présent avec écarts** : dis lesquels (prix, prix d'achat, image manquante, deuxième photo manquante, statut masqué, attributs vides).
- **Introuvable.**
- **En double** : plusieurs produits pour la même ligne.

**Puis corrige :**

- **Introuvables** : importe-les en suivant `korka/TACHE_livres_korka_integration.md` (catégorie, attributs, `titre_fournisseur`, `edition_statut`, `ouvrage_id`, galerie de photos depuis `photos_korka.zip`), avec une exception : publie-les au lieu de les laisser masqués.
- **Écarts de prix** : aligne le prix de vente sur le prix public et le prix d'achat sur -20 %, comme le demande la tâche Korka.
- **Masqués** : publie-les s'ils ont une image. Exception : les quatre produits Mobama restent masqués.
- **Doublons** : ne supprime rien. Liste-les, je choisirai.

Le script doit pouvoir être relancé sans rien créer en double. Relance-le à la fin : il doit afficher 41 lignes présentes, dont les 4 Mobama masquées.

## Vérifier

1. Les 92 produits en attente sont publiés, les 21 refusés n'ont pas bougé, et les 33 archivés sont toujours archivés.
2. Les trois nouveaux produits s'affichent avec leur photo et le bon prix, et « Les 4 cahiers magiques » est sur l'accueil.
3. `verif-korka` relancé : 41 sur 41 présents, aucun écart de prix, Mobama masqués.
4. Chercher « clé des cracks », « cahiers magiques » et « livre parlant » donne des résultats.
5. Le build et les tests passent.

## Compte rendu

Écris-le dans `maj-publication/rapport.md` :

- les produits publiés, et ceux publiés sans image ;
- les 33 archivés, avec la raison pour chacun ;
- les nouveaux produits créés ou mis à jour ;
- le résultat de `verif-korka` avant et après corrections ;
- les doublons trouvés.
