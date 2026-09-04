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
| 1 | Migration `0030` : table `sous_sous_categories` + `produits.sous_sous_categorie_id` (nullable) + seed ciblé (Électronique) + trigger de cohérence. Types TS + requêtes lecture. | ✅ livré (migration à exécuter) | `TBD` |
| 2 | Formulaire produit **vendeur** + **admin** : 3e select en cascade, affiché seulement si la sous-catégorie a des sous-sous-catégories, obligatoire seulement s'il apparaît. Règle selects CORRECTION_SELECTS_V2 (placeholder neutre, rien de présélectionné). | ✅ livré | `TBD` |
| 3 | Recherche : RPC + suggestions renvoient aussi **catégories** et **sous-sous-catégories** ; terme large → rayons d'abord. Page catégorie : filtre `?ssc=`. Indexation nom produit + cat + sous-cat + sous-sous-cat. | ✅ livré | `TBD` |
| 4 | Admin : vue arbre 3 niveaux dans « Catégories » (créer / renommer / réordonner / supprimer à chaque niveau). Responsive. | ⬜ à faire | — |
| 5 | Vérif finale + liste des migrations à exécuter + checklist de test. | ⬜ à faire | — |

## Migrations à exécuter par le fondateur (dans le SQL Editor Supabase)

- [ ] `0030_sous_sous_categories.sql` — (Lot 1)
- [ ] `0031_recherche_multi_niveaux.sql` — (Lot 3)

## Vérifications finales (spec §Vérification)

- [ ] Un produit d'électronique se range Catégorie > Sous-cat > Sous-sous-cat.
- [ ] Un cahier se range Catégorie > Sous-cat, sans 3e select.
- [ ] Taper « capteur » propose les rayons capteurs (sous / sous-sous) + produits.
- [ ] L'admin voit et gère toute l'arborescence à 3 niveaux dans « Catégories ».

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
