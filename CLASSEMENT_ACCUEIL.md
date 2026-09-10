# SacAdo — Algorithme de classement de l'accueil + identité anonyme & bénéficiaires

Chantier livré en 6 lots (specs : `TACHE_algorithme_classement.md`,
`TACHE_identite_et_beneficiaires.md`). L'accueil devient un **flux de produits
classé** par un score calculé hors ligne, personnalisé par une couche d'affinité
(session anonyme → compte → bénéficiaire), avec diversité, exploration et un
panneau d'administration complet.

## Migrations (toutes exécutées en prod, 2026-09-10)

| # | Contenu |
|---|---|
| `0046_mesure_evenements` | `pg_cron` + table `evenements` (RLS sans policy) + `produits.prix_achat` |
| `0047_score_global` | `config_classement`, `saisons` + `saisons_categories` (seed calendrier SN 2026-27), `classement_manuel`, `produits.score_global/score_details/vues_30j` + index partiel, `calculer_score_global()` + cron `score_global` (0 3 * * *), helper `normaliser_01()` |
| `0048_accueil_classe` | `accueil_classement()` — exclusions + quota 3/sous-catégorie + drapeau exploration ; RLS sur les 4 tables de config |
| `0049_affinites` | `affinites_session`, `affinites_utilisateur`, `sessions_comptes`, `niveaux_categories` (seed) ; `calculer_affinites()` + cron `affinites` (0 * * * *) ; `fusionner_session()` ; `accueil_classement()` recréé avec `p_affinites jsonb` + `p_facteur` |
| `0050_beneficiaires` | `beneficiaires` (prénom + niveau + série + établissement — **aucune date de naissance / nom / photo**), `affinites_beneficiaire`, `evenements.beneficiaire_id` ; `calculer_affinites()` + branche bénéficiaire |
| `0051_classement_admin` | `apercu_classement(jsonb)`, `impressions_accueil` + `enregistrer_impressions_accueil()` + `rendement_exploration()`, `reinitialiser_recommandations()`, `purger_donnees_reco()` + cron `purge_reco` (30 3 * * *) |

## Le score

**Couche 1 — global, recalculé chaque nuit à 3h**, stocké dans `produits.score_global` :

```
score_global = w_perf·performance + w_sais·saisonnalite + w_marge·marge + w_frais·fraicheur
             (0.45)              (0.30)               (0.15)         (0.10)   — poids dans config_classement
```

- **performance** : taux de conversion lissé `(ajouts + 5·taux_moyen)/(vues + 5)`, fenêtre 30 j, événements < 7 j comptés ×2, normalisé.
- **saisonnalité** : produit des coefficients des saisons actives (1.0 = neutre, jamais de pénalité).
- **marge** : `(prix − prix_achat)/prix`, normalisée sur les seuls produits ayant un prix d'achat ; les autres = neutre.
- **fraîcheur** : décroissance linéaire sur 60 j depuis `created_at`.

**Couche 2 — affinité personnelle**, appliquée à l'affichage (jamais stockée dans `produits`) :

```
score_final = score_global · (1 + 0.6 · affinite_normalisee[sous_categorie])
```

- Affinité mesurée (`calculer_affinites()` horaire, demi-vie 30 j, fenêtre 90 j) OU
  **démarrage à froid** par le niveau déclaré au sélecteur de kit (cookie `sacado_niveau`
  → `niveaux_categories`).
- Session anonyme (cookie `sacado_sid`, posé par `proxy.ts`) → compte à la 1re commande
  (`fusionner_session`, `sessions_comptes`).
- Un profil par bénéficiaire ; l'affinité du compte n'est **pas** la somme des enfants.

## Diversité

- **Quota** : 3 produits max par sous-catégorie (`row_number`).
- **Exploration** : 4 des 20 places réservées à des produits < 50 vues/30 j au score global
  > médiane, tirés au hasard, marqués `origine: 'exploration'`.
- **Exclusions** : sans photo, non publié, en rupture, délai > 6 j, exclu manuellement.

## Multi-bénéficiaires (`Tous` + puces prénom)

Round-robin `enfant 1 → enfant 2 → … → compte`, quota 3/sous-catégorie global, chaque carte
étiquetée « Pour \<prénom\> ». Sélectionner un prénom filtre sur ce seul profil.

## Panneau admin `/admin/classement`

6.1 poids · 6.2 aperçu avant/après (sans toucher la prod) · 6.3 décomposition + recherche ·
6.4 épinglage / exclusion · 6.5 interrupteur de personnalisation · 6.6 saisons ·
6.7 rendement de l'exploration.

## Conformité (loi 2008-12)

- `politique-confidentialite` : section « Suivi de navigation et recommandations ».
- `/moi/parametres` → « Réinitialiser mes recommandations » (supprime affinités **et**
  événements bruts du compte + session + bénéficiaires).
- Purge nocturne : `affinites_session` > 12 mois, `evenements` > 24 mois, `impressions_accueil` > 120 j.

## Perf

Toutes les requêtes d'affichage : tri sur colonne indexée (`produits.score_global`) +
arithmétique + jointure par id. **Aucune lecture de `evenements` à l'affichage.**

## Reste à faire (hors périmètre de ce chantier)

- Rappel de rentrée automatique, passage au niveau supérieur, historique par enfant (spec §2.6).
- `desactiverBeneficiaire` : afficher l'erreur en cas d'échec (actuellement silencieux).
- `<DeclarerNiveau>` sur la branche « kit indisponible » de `/kits/[cycle]/[niveau]`.
