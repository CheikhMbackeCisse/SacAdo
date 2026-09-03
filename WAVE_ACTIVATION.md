# SacAdo — Activation du paiement Wave (passage simulation → réel)

Le paiement Wave (lots W1→W5) est **codé et testable en mode simulation**. Ce
document est la marche à suivre le jour où le compte marchand Wave Business est
actif. Rien à recoder : uniquement de la config + une vérification.

Voir `INTEGRATION_WAVE.md` pour la spec, `MODELE_DONNEES.md` pour le schéma.

---

## 1. Pré-requis (fondateur, hors code)

- [ ] Compte marchand **Wave Business** vérifié (NINEA + CNI).
- [ ] Vérifier avec Wave que le nom affiché au client au paiement peut être
      « SacAdo » (nom commercial) et pas « UniShop ».
- [ ] Récupérer : **clé API secrète** + **secret de webhook**.

## 2. Migrations à exécuter (SQL Editor Supabase, dans l'ordre)

- [ ] `0023_paiement_wave.sql` — colonnes + statuts commande
- [ ] `0024_creer_commande_wave.sql` — `creer_commande` gère le mode Wave
- [ ] `0025_webhook_wave.sql` — table `wave_evenements` + `traiter_paiement_wave`

## 3. Variables d'environnement (Vercel + `.env.local`)

| Variable | Valeur |
|---|---|
| `WAVE_API_KEY` | clé API secrète Wave (⚠️ pas de préfixe `NEXT_PUBLIC_`) |
| `WAVE_WEBHOOK_SECRET` | secret de signature des webhooks |
| `WAVE_API_BASE_URL` | `https://api.wave.com/v1` (défaut, ne changer que sur indication Wave) |
| `NEXT_PUBLIC_SITE_URL` | domaine de prod, sans slash final |

Dès que `WAVE_API_KEY` est renseignée, le mode simulation se coupe tout seul
(`/paiement/simulation` devient inaccessible, `simulerPaiementWave` refuse).

## 4. Configuration côté Wave Business

- [ ] Déclarer l'URL de webhook : `<NEXT_PUBLIC_SITE_URL>/api/wave/webhook`
- [ ] **Vérifier le schéma exact de signature** contre la doc Wave et, si besoin,
      ajuster `lib/wave/webhook-core.ts` (en-tête `Wave-Signature`, message signé
      `${t}.${corps}`) — c'est le seul point d'incertitude du code.

## 5. Tests de recette (les 4 du doc + le seuil)

Faire un vrai paiement d'un **petit montant** :

- [ ] **Paiement complet** : checkout Wave → page Wave → payer → retour app →
      la commande passe `payee` / `recue`, message « Commande reçue » dans la
      boîte de réception, apparaît dans le CA admin.
- [ ] **Retour sans payer** : arriver sur `/checkout/confirmation?ref=…` d'une
      commande encore en attente → l'écran affiche « en attente de confirmation »,
      la commande **ne passe pas** `payee`.
- [ ] **Webhook doublé** : Wave rejoue le webhook → la commande n'est traitée
      qu'une fois (vérifier `wave_evenements`, pas de double message ni double
      mouvement de stock).
- [ ] **Annulation** : annuler sur Wave → retour app avec « Paiement annulé » +
      bouton « Réessayer », **stock relâché**, commande reste `paiement_en_attente`.
- [ ] **Seuil** : panier < 10 000 FCFA → 2 options (Wave / livraison) ;
      panier ≥ 10 000 FCFA → Wave imposé, « à la livraison » indisponible.
- [ ] **Montant** : le montant encaissé affiché dans l'admin (fiche commande)
      correspond au total.

## 6. Go / No-go déploiement

- [ ] Ne déployer la prod ouverte aux clients **qu'une fois les vraies clés en
      place**. En simulation, une commande peut être marquée payée sans paiement.
