# SacAdo — Suivi du chantier « sous-sous-catégories » (3e niveau)

Spec : `../SOUS_SOUS_CATEGORIES.md`. Notes de fond : `../NOTE_CATEGORIES_EN_BASE.md`,
`../NOTE_SOUS_CATEGORIES.md`. Respecter `CLAUDE.md`.

Hiérarchie cible : **Catégorie → Sous-catégorie → Sous-sous-catégorie (optionnelle)**.
Le 3e niveau n'existe QUE pour les sous-catégories où il est pertinent (ex.
Électronique → Capteurs → Capteurs de température…). Jamais imposé.

État de la base au démarrage : tables `categories`, `sous_categories`
(`categorie_id` FK), `produits` (`categorie_id` + `sous_categorie_id`). Recherche
via RPC `suggestions_recherche(p_terme)` et `rechercher_produits(...)`.

---

## Découpage en lots

| Lot | Contenu | État | Commit |
|-----|---------|------|--------|
| 1 | Migration `0030` : table `sous_sous_categories` + `produits.sous_sous_categorie_id` (nullable) + seed ciblé (Électronique) + trigger de cohérence. Types TS + requêtes lecture. | ✅ livré, migration exécutée | `f460346` |
| 2 | Formulaire produit **vendeur** + **admin** : 3e select en cascade, affiché seulement si la sous-catégorie a des sous-sous-catégories, obligatoire seulement s'il apparaît. Règle selects CORRECTION_SELECTS_V2 (placeholder neutre, rien de présélectionné). | ✅ livré | `b0c3cad` |
| 3 | Recherche : RPC + suggestions renvoient aussi **catégories** et **sous-sous-catégories** ; terme large → rayons d'abord. Page catégorie : filtre `?ssc=`. Indexation nom produit + cat + sous-cat + sous-sous-cat. | ✅ livré, migration exécutée | `25d2d01` |
| 4 | Admin : vue arbre 3 niveaux dans « Catégories » (créer / renommer / réordonner / supprimer à chaque niveau). Responsive. | ✅ livré | `70d7dab` |
| 5 | Vérif finale + liste des migrations à exécuter + checklist de test. | ✅ livré ; migrations EXÉCUTÉES 2026-09-04, vérif fonctionnelle + push/déploiement restants | — |

## Migrations à exécuter par le fondateur (dans le SQL Editor Supabase)

- [x] `0030_sous_sous_categories.sql` — (Lot 1) — EXÉCUTÉE 2026-09-04
- [x] `0031_recherche_multi_niveaux.sql` — (Lot 3) — EXÉCUTÉE 2026-09-04

## Vérifications finales (spec §Vérification) — migrations exécutées, à vérifier en conditions réelles

- [ ] Un produit d'électronique se range Catégorie > Sous-cat > Sous-sous-cat
      (ex. Électronique > Capteurs > Capteurs de température).
- [ ] Un cahier se range Catégorie > Sous-cat, sans 3e select (aucune sous-sous
      n'existe pour « Cahiers 96 pages » etc. — le select n'apparaît pas).
- [ ] Taper « capteur » dans la recherche propose les rayons capteurs (sous- et
      sous-sous-catégorie) puis des produits, sans faute de frappe qui bloque
      (ex. « capteure », « capteur »).
- [ ] L'admin voit et gère toute l'arborescence à 3 niveaux dans « Catégories »
      (créer/renommer/réordonner/supprimer à chaque niveau), lisible sur mobile.
- [ ] La page catégorie affiche la 2e rangée de chips (3e niveau) uniquement
      quand la sous-catégorie choisie en a un, et le lien direct
      `/categorie/electronique-arduino?sc=capteurs&ssc=capteurs-temperature`
      arrive bien filtré.
- [ ] `/admin/sous-categories` redirige vers `/admin/categories` sans erreur.

## Journal

- **Lot 1** — livré. Migration `0030_sous_sous_categories.sql` : table
  `sous_sous_categories` (nom, slug, `sous_categorie_id` FK, ordre), colonne
  nullable `produits.sous_sous_categorie_id`, index trgm, RLS lecture publique,
  seed ciblé (Électronique → Capteurs / Cartes Arduino / Composants), trigger
  `trg_produit_coherence_sous_sous_categorie` (le 3e niveau posé sur un produit
  doit appartenir à sa sous-catégorie). Types `SousSousCategorie` +
  `Produit.sous_sous_categorie_id`. Requêtes `getSousSousCategoriesBySousCategorie`
  + filtre `sousSousCategorieId` dans `getProduitsByCategorie`. `tsc` + `eslint`
  OK. **Rien ne casse sans la migration** (repli `console.warn` + `[]`).
- **Lot 2** — livré. `ProduitForm` (admin) et `ProduitVendeurForm` (vendeur) : 3e
  select `Sous-sous-catégorie` conditionnel (n'apparaît que si la sous-catégorie
  choisie en a), obligatoire seulement s'il apparaît, se réinitialise si la
  catégorie/sous-catégorie change. Admin peut créer une sous-sous-catégorie à la
  volée (une fois qu'il en existe déjà au moins une pour cette sous-catégorie —
  démarrer un 3e niveau sur une sous-catégorie qui n'en a encore aucune se fait
  depuis l'écran Catégories, Lot 4) ; le vendeur choisit seulement parmi
  l'existant (spec §1). `lib/admin/sous-sous-categories-actions.ts` (CRUD,
  repli si table absente). `ProduitInput` / `ProduitVendeurInput` +
  `sous_sous_categorie_id`, avec repli 42703 (colonne absente) comme pour les
  autres colonnes ajoutées par migration récente. `tsc` + `eslint` OK.
- **Lot 3** — livré. Migration `0031` : `rechercher_produits` et
  `suggestions_recherche` matchent aussi sur le nom de la catégorie / sous-cat /
  sous-sous-cat du produit (pas seulement son propre nom). `suggestions_recherche`
  renvoie en plus `categories` et `sous_sous_categories` (avec le chemin complet
  slugs/noms pour construire le lien et le sous-titre « dans X › Y »). Header :
  panneau de suggestions dans l'ordre catégories → sous-cat → sous-sous-cat →
  produits (les rayons aident à affiner avant la liste de produits, terme large
  ou pas). Page catégorie (`CategoryProductList`) : 2e rangée de chips sous la
  rangée sous-catégories, visible seulement si la sous-catégorie active a un 3e
  niveau ; état dans l'URL (`?sc=&ssc=`), les deux niveaux filtrent
  `getProduitsByCategorie`. `tsc` + `eslint` OK.
- **Lot 4** — livré. `components/admin/categories-tree-editor.tsx` (nouveau) :
  vue arbre unique Catégorie → Sous-catégorie → Sous-sous-catégorie, chaque
  niveau repliable (`<details>`, lisible sur mobile), créer / renommer /
  réordonner / supprimer à chaque niveau — y compris démarrer un 3e niveau sur
  une sous-catégorie qui n'en a encore aucun. `/admin/categories` regroupe
  désormais tout (remplace les deux écrans séparés « Catégories » /
  « Sous-catégories ») ; `/admin/sous-categories` redirige vers
  `/admin/categories` (compat liens/favoris existants) ; entrée de nav
  « Sous-catégories » retirée. Anciens `categories-editor.tsx` /
  `sous-categories-editor.tsx` supprimés (remplacés). `tsc` + `eslint` OK.
- **Lot 5** — ce fichier. Migrations 0030 et 0031 **EXÉCUTÉES par le fondateur
  le 2026-09-04**. Reste : vérifier la checklist ci-dessus en conditions
  réelles, puis push/déploiement.
