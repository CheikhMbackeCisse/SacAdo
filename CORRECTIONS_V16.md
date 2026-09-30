# CORRECTIONS V16 : nouveaux kits (préscolaire → Terminale)

Lis d'abord `CLAUDE_SacAdo.md` et `ETAT_KITS.md`. Ce chantier remplace le contenu de 69 kits
par la composition validée par le fondateur. Travaille lot par lot et **arrête-toi après chaque
lot** pour me montrer le résultat avant de passer au suivant.

## Fichiers fournis (à copier dans le repo)
- `SacAdo_nouveaux_kits_V2.xlsx` → `data/kits/SacAdo_nouveaux_kits_V2.xlsx`
- `prod-je-me-debrouille-en-anglais.webp` → `public/images/prod-je-me-debrouille-en-anglais.webp`
- `prod-dictionnaire-larousse-poche.webp` → `public/images/prod-dictionnaire-larousse-poche.webp`

Les deux images font moins de 200 Ko. Envoie-les aussi dans le stockage Supabase des photos
produits, comme pour les autres produits.

## Le fichier Excel
- Onglet **Contenu des kits** (en-têtes ligne 1) : une ligne par article de kit. C'est la seule
  source pour l'import. Colonnes utilisées :
  B Classe, C Gamme, D Ordre, E Groupe d'affichage, F Libellé (vu par le client), G ID produit,
  I Quantité, J Prix unitaire, K Section, L Coché, N Statut, R Prix d'achat.
- Onglet **Récap par kit** (en-têtes ligne 4) : B Classe, C Gamme, D ID du kit dans l'app,
  F Nouveau prix attendu. Sert au contrôle.
- Correspondances :
  - Section : `Principal` → `principal`, `Livres proposés` → `livres_proposes`, `Option` → `option`.
  - Coché : `Oui` / `Non` → le type de la colonne `coche_par_defaut`.
  - Statut `MANQUE` (colonne G vide) : **ne pas importer** ces lignes (produit absent du
    catalogue). Les lister dans le rapport.
  - Les autres statuts (`OK`, `À CONFIRMER`, `SUBSTITUT`, `À CRÉER`) s'importent normalement.
  - Codes provisoires dans la colonne G : `CRAIE-U`, `ANGLAIS-JMD`, `LAROUSSE-60`. Ils seront
    remplacés par les vrais ID créés au lot B.

---

## Lot A : sauvegarde et vérifications (lecture seule)
1. Sauvegarde les tables `kits` et `kit_items` complètes (avec pagination par 1 000) dans
   `backups/2026-09-30_kits_avant_V16/` (JSON).
2. Vérifie comment les commandes gardent la trace des kits. Si une table de commande
   référence `kit_items` par clé étrangère, **ne supprime pas** les anciennes lignes : propose
   une autre méthode (archivage ou version) et attends mon accord.
3. Vérifie que les 69 couples (Classe, Gamme) du Récap existent dans `kits` avec l'ID indiqué.
4. Vérifie que chaque ID produit de l'Excel existe. Liste :
   - les produits introuvables ;
   - les produits non publiés (1509 est en attente de modération : c'est connu) ;
   - les produits dont le prix en base diffère de la colonne J (sauf 1287, traité au lot B).
5. Vérifie que les groupes d'affichage de l'Excel sont acceptés par l'app (si c'est une liste
   fermée, dis-moi lesquels manquent) : Cahiers, Écriture, Petit matériel, Géométrie,
   Art & dessin, Ardoise, Protège-cahiers, Papier, Rangement, Accessoires, Manuels au programme,
   Manuels scolaires, Œuvres au programme, Parascolaire, Cahiers d'activités et compléments, Option.

**Point de contrôle A** : montre-moi le rapport. N'écris rien en base.

## Lot B : produits et kits masqués
Script `scripts/v16_produits.ts` avec `--dry-run` par défaut, `--apply` pour écrire.
1. Créer 3 produits :
   - « Craie blanche Giotto Robercolor (à l'unité) » : vendeur LPD, prix 25 FCFA, prix d'achat
     25 FCFA, même catégorie, sous-catégorie et photo que le produit 1299, délai 6j.
   - « Je me débrouille en anglais » (auteur John Smith) : vendeur LPD, prix 3 000 FCFA, prix
     d'achat 2 000 FCFA, catégorie Livres et annales, niveau Lycée, photo
     `prod-je-me-debrouille-en-anglais.webp`, délai 6j.
   - « Dictionnaire Larousse de français de poche, 60 000 mots » : vendeur LPD, prix
     2 750 FCFA, prix d'achat 2 000 FCFA, même catégorie et sous-catégorie que 1682, photo
     `prod-dictionnaire-larousse-poche.webp`, délai 6j.
   Stock et statut de publication : comme les autres produits LPD.
2. Produit 1287 « Gourde Drink violette » : prix 2 500 FCFA (au lieu de 2 000).
3. Masquer les 9 kits de la série T, encore publiés : 502, 503, 504, 517, 518, 519, 538, 539, 540.
   Ne pas les supprimer.
4. Écrire la correspondance code → ID dans `data/kits/v16_nouveaux_produits.json`.
5. La page produit et le sitemap doivent se régénérer pour les nouveaux produits (mécanisme
   déjà en place).

**Point de contrôle B** : dry-run d'abord, puis `--apply` après mon accord. Donne les 3 ID créés.

## Lot C : import des kits
Script `scripts/v16_import_kits.ts` avec `--dry-run` par défaut, `--apply` pour écrire.
1. Lit l'onglet Contenu des kits, remplace les codes provisoires par les ID du lot B.
2. Pour chacun des 69 kits, dans **une transaction par kit** : remplace les `kit_items` par les
   lignes de l'Excel (méthode validée au lot A), avec ordre, groupe, libellé, produit, quantité,
   section et coché par défaut.
3. Si le prix du kit est stocké dans une colonne, recalcule-le. Sinon ne fais rien.
4. Contrôle avant d'écrire, pour chaque kit : total des lignes `principal` cochées (prix en base
   × quantité) = colonne F du Récap. Si un seul kit ne correspond pas, le script s'arrête et
   affiche l'écart.
5. Rapport du dry-run, par kit : nombre de lignes avant et après, prix avant et après, lignes
   `MANQUE` ignorées. Vérifie aussi que l'ordre Essentiel < Complet < Confort est respecté
   dans chaque classe.
6. Images du kit (4 par kit : un cahier, la géométrie, un livre, le pack Schneider) : la
   géométrie est maintenant le produit 1229 (boîte d'instruments Marshal). S'il n'a pas de
   photo, dis-le-moi et garde l'ancienne image de géométrie en attendant.

**Point de contrôle C** : dry-run d'abord, puis `--apply` après mon accord.

## Lot D : vérification dans l'app
Sur mobile et sur desktop, avec des captures, vérifie :
- Kit CE1 Essentiel : une seule ligne « Matériel géométrique », « Craies blanches » en
  quantité 20, livres proposés décochés.
- Kit 3e Confort, Terminale S1 Complet et Première L1 Confort : groupes affichés, livres
  cochés, Larousse et « Je me débrouille en anglais » présents en Première L1 Confort.
- Ajout au panier d'un kit : une seule carte « Votre kit … », total égal au prix du Récap.
- Les kits de la série T n'apparaissent plus pour un visiteur.
- Aucune page 404 sur les écrans kits.

## Fin
`tsc`, `eslint`, `npm test`, `next build`, puis `vercel --prod --yes`. Donne-moi l'URL déployée
et le récapitulatif de ce qui a été écrit en base.
