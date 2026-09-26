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
- [ ] `0087_wave_erreur_paiement.sql` — colonnes `wave_erreur_code` /
      `wave_erreur_le` (diagnostic des échecs) + `traiter_paiement_wave` à 6 args

## 3. Variables d'environnement (Vercel + `.env.local`)

| Variable | Valeur |
|---|---|
| `WAVE_API_KEY` | clé API secrète Wave (⚠️ pas de préfixe `NEXT_PUBLIC_`) |
| `WAVE_SIGNING_SECRET` | secret de **signature de requête** (`wave_sn_AKS_…`), DISTINCT du secret de webhook — obligatoire pour tout appel sortant dès que cette clé API a la signature de requête activée |
| `WAVE_WEBHOOK_SECRET` | secret de signature des webhooks entrants (`wave_sn_WHS_…`) |
| `WAVE_API_BASE_URL` | `https://api.wave.com/v1` (défaut, ne changer que sur indication Wave) |
| `NEXT_PUBLIC_SITE_URL` | domaine de prod, sans slash final |
| `FIXIE_URL` | fournie par l'add-on Fixie (IP fixe) — nécessaire tant que le filtrage IP est actif côté Wave, voir §7 |

Dès que `WAVE_API_KEY` est renseignée, le mode simulation se coupe tout seul
(`/paiement/simulation` devient inaccessible, `simulerPaiementWave` refuse). Si
`WAVE_API_KEY` est renseignée mais `WAVE_SIGNING_SECRET` ne l'est pas, la
création de session échoue proprement (message générique au client, détail en
log serveur) plutôt que d'envoyer une requête non signée que Wave rejetterait.

⚠️ **Aucune liste blanche d'IP** sur ce compte, et il ne doit jamais y en
avoir : l'activation est irréversible côté Wave et incompatible avec un
hébergement serverless (Vercel).

## 4. Configuration côté Wave Business

- [ ] Créer une **clé API** avec la **signature de requête activée** — noter le
      **signing secret** (`wave_sn_AKS_…`), visible une seule fois → `WAVE_SIGNING_SECRET`.
- [ ] Déclarer l'URL de webhook : `<NEXT_PUBLIC_SITE_URL>/api/wave/webhook`,
      récupérer le **secret de webhook** (`wave_sn_WHS_…`) → `WAVE_WEBHOOK_SECRET`.
- [ ] Schéma de signature (entrant ET sortant) implémenté d'après
      `docs.wave.com/checkout` et `docs.wave.com/webhook` : en-tête
      `Wave-Signature: t=…,v1=…`, HMAC-SHA256 de `${t}${corps brut}` en
      concaténation directe, tolérance 5 min (webhook) / 5 min passé - 30 s futur
      (requêtes sortantes, contrôlé par Wave). Un seul endroit à toucher si Wave
      change le schéma : `signerCorpsWave()` / `verifierSignatureHmac()` dans
      `lib/wave/webhook-core.ts` (utilisé pour les deux sens).
- [ ] Endpoint utilisé : `POST https://api.wave.com/v1/checkout/sessions`
      (body `amount`/`currency`/`success_url`/`error_url`/`client_reference`,
      réponse `id` + `wave_launch_url`) — conforme à `docs.wave.com/checkout`.

## 5. Tests de recette

**Pas de sandbox Wave documenté** : les tests se font avec un **vrai paiement
d'un petit montant**. À dérouler soi-même :

- [ ] **Paiement complet** : checkout Wave → page Wave → payer → retour app →
      la commande passe `payee` / `recue`, message « Commande reçue » dans la
      boîte de réception, apparaît dans le CA admin.
- [ ] **Retour sans payer** : arriver sur `/checkout/confirmation?ref=…` d'une
      commande encore en attente → l'écran affiche « en attente de confirmation »,
      la commande **ne passe pas** `payee`.
- [ ] **Webhook doublé** : Wave rejoue le webhook → la commande n'est traitée
      qu'une fois (vérifier `wave_evenements`, pas de double message ni double
      mouvement de stock).
- [ ] **Annulation** : annuler sur Wave → retour app avec message d'échec +
      bouton « Réessayer », **stock relâché**, commande reste `paiement_en_attente`.
- [ ] **Échec avec code d'erreur** (si Wave le déclenche facilement, ex. solde
      insuffisant) : `/checkout/paiement-echoue` affiche un message français
      spécifique (pas le texte générique), et `commandes.wave_erreur_code` /
      `wave_erreur_le` sont renseignés en base pour cette commande.
- [ ] **Session expirée** (attendre 30 min sans payer) : la commande reste
      `paiement_en_attente` ; vérifier si Wave envoie un webhook pour ce cas ou
      s'il faut prévoir un nettoyage manuel/périodique (non couvert par le code
      actuel, à surveiller lors de ce premier test réel).
- [ ] **Seuil** : panier < 10 000 FCFA → 2 options (Wave / livraison) ;
      panier ≥ 10 000 FCFA → Wave imposé, « à la livraison » indisponible.
- [ ] **Montant** : le montant encaissé affiché dans l'admin (fiche commande)
      correspond au total.

## 6. Go / No-go déploiement

- [ ] Ne déployer la prod ouverte aux clients **qu'une fois les vraies clés en
      place**. En simulation, une commande peut être marquée payée sans paiement.

## 7. Proxy Fixie (filtrage IP côté Wave)

Le compte Wave a la fonctionnalité "IP Whitelisting" activée (dashboard Wave >
Developers > IP Whitelisting), sans option de désactivation en libre-service.
Les fonctions serverless Vercel n'ayant pas d'IP de sortie fixe, l'appel
`POST /checkout/sessions` passerait par une IP différente à chaque exécution et
serait systématiquement rejeté (`403 ip-not-allowed`).

Solution retenue : l'add-on **Fixie** (plan gratuit, 500 requêtes/mois) fournit
une IP fixe via un proxy HTTP. Seul l'appel de création de session Wave passe
par ce proxy (`lib/wave/client.ts`, dispatcher `undici.ProxyAgent` construit à
partir de `FIXIE_URL`) — aucun autre appel sortant de l'app (Supabase,
OpenFreeMap, etc.) n'est concerné, pour ne pas consommer le quota inutilement.
La signature HMAC (`Wave-Signature`) est calculée sur le corps brut AVANT
l'envoi, exactement comme un appel direct — le proxy ne change que le chemin
réseau.

- [ ] Ajouter l'IP fixe donnée par Fixie à la liste blanche du dashboard Wave
      (Developers > IP Whitelisting > Ajouter une adresse IP).
- [ ] Surveiller le quota (500 req/mois) si le volume de commandes Wave
      augmente — une requête Wave = une requête Fixie consommée.
