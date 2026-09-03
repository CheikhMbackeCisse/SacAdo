# SacAdo — Modèle de données (v1)

À utiliser comme base de la session Claude Code. Stable quelle que soit la techno.
Décisions verrouillées : livraison partout (Dakar = zone la moins chère), historique
client identifié par le **numéro de téléphone WhatsApp**.

## Tables

### produits
| champ | type | note |
|---|---|---|
| id | id | |
| nom | texte | |
| categorie | texte | Cahiers, Écriture, Géométrie, Cartables, Livres, Informatique |
| prix | entier | en FCFA |
| delai | enum | "24h" ou "6j" |
| photo | url | |
| stock | entier | quantité réelle, **jamais affichée au client** |
| seuil_alerte | entier | ex. 5 → alerte admin |
| statut | enum | "dispo" / "sur_commande" / "epuise" (auto: stock 0 → epuise) |

### kits
| champ | type | note |
|---|---|---|
| id | id | |
| cycle | enum | prescolaire / elementaire / college / lycee (ajout v2) |
| niveau | texte | CI, CP, CE1 ... Tle |
| gamme | enum | essentiel / confort / complet (ajout Lot 3 — migration 0007) |
| nom | texte | ex. "Kit CE2 Confort" |

> Unicité : (cycle, niveau, gamme). Chaque classe expose 2–3 gammes, chacune
> avec ses propres kit_items. Le parcours devient cycle → classe → **gamme** → kit.
> L'ebook de la classe est offert à l'achat du kit complet quelle que soit la
> gamme (affichage seulement en v1, pas de ligne en base).

### kit_items
| champ | type | note |
|---|---|---|
| kit_id | ref kits | |
| produit_id | ref produits | |
| quantite_defaut | entier | quantité pré-cochée dans le kit |

### clients
| champ | type | note |
|---|---|---|
| id | id | |
| nom | texte | |
| telephone | texte | **identifiant unique** (WhatsApp). Un client revenant = même numéro |
| zone | ref zones | dernière zone connue |
| date_creation | date | |

> Pas de mot de passe en v1. Le numéro identifie et relie l'historique.

### zones
| champ | type | note |
|---|---|---|
| id | id | |
| nom | texte | Dakar, Thiès, Autres régions |
| tarif_6j | entier | Dakar le moins cher |
| tarif_24h | entier | plus cher que 6j |

### commandes
| champ | type | note |
|---|---|---|
| id | id | numéro de commande |
| client_id | ref clients | |
| zone_id | ref zones | |
| adresse | texte | point de repère |
| mode_livraison | enum | "24h" / "6j" |
| frais_livraison | entier | calculé (0 si total ≥ seuil gratuité) |
| mode_paiement | enum | "livraison" (payé au livreur) / "wave" (payé d'avance). Orange Money : reporté |
| statut_paiement | enum \| null | paiement Wave : "en_attente" / "payee" / "echoue" / "annulee". **null** si payé à la livraison |
| wave_session_id | texte \| null | id de session de paiement renvoyé par Wave |
| wave_event_id | texte \| null | id du dernier événement webhook traité (idempotence, index unique) |
| montant_paye | entier \| null | montant réellement encaissé (FCFA), revérifié serveur |
| sous_total | entier | |
| total | entier | sous_total + frais_livraison |
| statut | enum | "paiement_en_attente" / "recue" / "preparation" / "livraison" / "livree" |
| date | datetime | |

> **Paiement Wave** (voir `INTEGRATION_WAVE.md` + `WAVE_ACTIVATION.md`,
> migrations 0023-0025). Une commande Wave est créée en
> `statut = "paiement_en_attente"` (hors du flux de préparation, exclue du
> CA/ventes, aucun message boîte de réception) ; le stock est réservé dès la
> création. Le **webhook signé** (`/api/wave/webhook` → `traiter_paiement_wave`)
> la fait passer `recue` + `statut_paiement = "payee"` après revérification du
> montant ; en cas d'échec/annulation, `statut_paiement = "echoue"` et le stock
> est relâché. Le retour du client sur la success_url ne vaut jamais preuve de
> paiement. Seuil : total < 10 000 FCFA → client choisit ; ≥ 10 000 → Wave
> imposé (calcul serveur).

### wave_evenements (idempotence webhook)
| champ | type | note |
|---|---|---|
| event_id | texte | **PK** — id d'évènement Wave, jamais traité deux fois |
| commande_id | ref commandes | commande concernée (nullable si supprimée) |
| type | texte | issue journalisée (paye / echoue / montant_invalide / …) |
| recu_le | datetime | |

### commande_items
| champ | type | note |
|---|---|---|
| commande_id | ref commandes | |
| produit_id | ref produits | |
| quantite | entier | |
| prix_unitaire | entier | **figé** au moment de l'achat (ne suit pas les changements de prix) |

## Règles métier (pas des tables)
- **Seuil gratuité livraison** : 50 000 FCFA. Si sous_total ≥ 50 000 → frais_livraison = 0.
- **Sinon** : frais_livraison = tarif de la zone selon mode_livraison (24h ou 6j).
- **Statut produit** : stock atteint 0 → statut "epuise", bouton désactivé côté client.
- **Alerte stock bas** : stock ≤ seuil_alerte → notification admin.

## Les deux vues admin demandées
- **Articles vendus (cumulé)** : SOMME(commande_items.quantite) GROUP BY produit
  → "72 gommes, 31 kits CE2, 14 calculatrices". Sert à savoir quoi racheter.
- **Commandes par client** : commandes filtrées par client_id (via téléphone)
  → "Amadou → ces articles, ce montant, ce statut" + tout son historique.

## Back-office admin — fonctions v1
- CRUD produits (photo, prix, catégorie, délai, stock, seuil, statut)
- CRUD kits et kit_items
- Liste commandes filtrable par statut + changement de statut en 1 clic
  (→ déclenche le message WhatsApp au client)
- Vue "articles vendus" + vue "commandes par client"
- Gestion des zones (tarifs) sans toucher au code
- Tableau de bord : CA du jour, nb commandes, panier moyen, top produits, alertes stock

---

## Ajouts v1 (favoris, historique, messages) — suite aux retours écran Accueil/Moi

### Stockage LOCAL sur l'appareil (pas de compte requis en v1)
Ces deux listes vivent sur le téléphone de l'utilisateur (local storage / IndexedDB),
pour offrir "Favoris" et "Déjà consultés" sans obliger à créer un compte :
- **favoris_local** : liste d'ids produits marqués d'un cœur.
- **consultes_local** : liste d'ids produits récemment vus (avec horodatage,
  garder les N derniers, ex. 20).

> Au moment du scale (comptes clients), ces listes locales pourront être
> rattachées au client via son numéro et synchronisées côté serveur.
> Le modèle est prévu pour : rien à casser.

### messages (boîte de réception) — côté serveur
| champ | type | note |
|---|---|---|
| id | id | |
| client_id | ref clients | destinataire (via téléphone) |
| type | enum | "commande" (mise à jour statut) / "info" / "promo" |
| titre | texte | |
| corps | texte | |
| lu | booléen | |
| date | datetime | |

Les mises à jour de statut de commande (Reçue -> ... -> Livrée) génèrent
automatiquement un message ici, en plus de la notification WhatsApp.

## Navigation (rappel structure)
Bottom nav à 5 entrées : Accueil, Catégories, Panier, Commandes, **Moi**.
La page **Moi** contient : Mes commandes, Boîte de réception, Favoris,
Déjà consultés, Assistance ; et une icône **Paramètres** (langue, compte,
confidentialité, déconnexion) en haut à droite.

## Catégories (remplacent les cartes de niveaux sur l'accueil)
Liste large, scroll horizontal fluide, ex. :
Kits, Ordinateurs, Fournitures élève, Fournitures d'école, Géométrie, Cartables,
Livres, Électronique/Arduino, Informatique, Art & dessin.
> Les niveaux (CI...Tle) ne sont PAS des catégories d'accueil : ils vivent
> À L'INTÉRIEUR de la catégorie "Kits".

---

## Ajouts v2 — variantes produit & parcours kits par cycle

### Variantes (produits avec tailles / couleurs)
Un produit peut avoir des variantes (ex. cartable en 3 couleurs, tablier en 4 tailles).
Le **stock se gère à la variante**, pas au produit parent.

#### produit_variantes
| champ | type | note |
|---|---|---|
| id | id | |
| produit_id | ref produits | le parent |
| couleur | texte | optionnel (null si pas de dimension couleur) |
| taille | texte | optionnel (null si pas de dimension taille) |
| prix | entier | optionnel : surcharge le prix parent si présent |
| stock | entier | **stock réel de CETTE combinaison** |
| statut | enum | dispo / epuise (auto: stock 0) |
| photo | url | optionnel : photo spécifique à la couleur |

Règles :
- Un produit SANS variante fonctionne comme avant (stock sur `produits`).
- Un produit AVEC variantes : le stock parent est ignoré, on somme/So lit les variantes.
- Fiche produit : sélecteur couleur + taille ; combinaison indisponible -> désactivée.
- **commande_items** référence la **variante choisie** quand elle existe :
  ajouter un champ `variante_id` (ref produit_variantes, nullable).

> Mettre à jour commande_items :
> | variante_id | ref produit_variantes | nullable (null si produit sans variante) |

### Parcours Kits (écran intermédiaire)
La catégorie "Kits" ouvre un parcours **cycle -> classe** avant le kit lui-même
(écran cycle `/kits` avec photo par cycle -> page classes `/kits/[cycle]` ->
gammes `/kits/[cycle]/[niveau]`) :
- **cycles** : Préscolaire, Élémentaire, Collège, Lycée.
- chaque cycle contient ses **classes** :
  - Préscolaire : Petite / Moyenne / Grande section
  - Élémentaire : CI, CP, CE1, CE2, CM1, CM2
  - Collège : 6e, 5e, 4e, 3e
  - Lycée : Seconde L, Seconde S, Première L1, Première L2, Première S1,
    Première S2, Terminale L1, Terminale L2, Terminale S1, Terminale S2,
    Terminale T, Terminale G (niveaux en toutes lettres ; séries à partir de
    la Première ; l'écran /kits/[cycle] regroupe par Seconde/Première/Terminale)
- La table **kits** gagne un champ `cycle` (enum) en plus de `niveau`.

> Mettre à jour kits :
> | cycle | enum | prescolaire / elementaire / college / lycee |

Ce n'est pas forcément deux nouvelles tables : `cycle` + `niveau` sur `kits`
suffisent. L'écran 10 filtre les kits par cycle puis par niveau.

## Catégories de l'accueil (grille 2 rangées, scroll horizontal)
Référentiel en base (`categories`, 14 lignes). Ordre validé — CORRECTIONS_V7 §4,
appliqué via `categories.ordre` (migration 0026). La grille se remplit **colonne
par colonne** (`grid-flow-col grid-rows-2`), d'où l'`ordre` séquentiel :

| Colonne | Haut (`ordre`) | Bas (`ordre`) |
|---|---|---|
| 1 | Kits scolaires (1) | Cahiers & papeterie (2) |
| 2 | Cartables & sacs (3) | Livres & manuels (4) |
| 3 | Informatique (5) | Électronique (6) |
| 4 | Matériel géométrique (7) | Mobilier (8) |
| 5 | Hygiène & cantine (9) | Sport & EPS (10) |
| 6 | Fournitures d'école (11) | Art & dessin (12) |
| 7 | Écriture (13) | Ebooks (14) |

Affichage : 3 colonnes visibles + amorce de la 4e (`auto-cols-[28%]`). Même ordre
sur l'accueil et sur la page Catégories. "Kits scolaires" -> parcours cycle/classe.

## Note build (Claude Code)
Prévoir l'usage du MCP 21st.dev (Magic) et de skills UI/UX au moment du build front
pour des composants React propres : carrousel hero, grille catégories scrollable,
sélecteur de variantes, stepper de statut. Stitch sert de référence visuelle, pas de
code final.

---

## Mise à jour finale v1 (décisions verrouillées)

### Paiement
- **À la livraison + Wave en ligne selon un seuil** (spec : `INTEGRATION_WAVE.md`,
  migration 0023).
  * `mode_paiement` ∈ {"livraison", "wave"}. Orange Money : reporté (pas gratuit).
  * Seuil, calculé **côté serveur** sur le total : < 10 000 FCFA → le client
    choisit ; ≥ 10 000 FCFA → Wave imposé.
  * Preuve de paiement = **webhook Wave signé** (HMAC-SHA256) + idempotence via
    `wave_event_id` + revérification du montant serveur. Le retour sur la
    success_url ne vaut jamais paiement.
  * Colonnes `commandes` : `statut_paiement`, `wave_session_id`, `wave_event_id`,
    `montant_paye` (toutes null si payé à la livraison). Statut `commandes`
    gagne `"paiement_en_attente"` en entrée de flux.
- Le logo Orange Money peut rester affiché à titre informatif (paiement possible
  au livreur pour les commandes payées à la livraison).

### Notifications
- **Boîte de réception in-app uniquement** (table `messages` déjà définie).
- Chaque transition de statut de commande insère automatiquement un message
  de type "commande" pour le client concerné.
- Pas de WhatsApp/API en v1. Le modèle `messages` est prêt à recevoir un canal
  supplémentaire plus tard (ajouter un champ `canal` si besoin).

### Admin
- **Une seule connexion admin** via Supabase Auth (email + mot de passe).
- Toutes les fonctions admin sont derrière cette authentification.

### Données de démo
- Seeder ~30 produits réalistes (cahiers, stylos, calculatrices, cartables,
  quelques ordinateurs, matériel de géométrie), avec quelques produits à variantes
  (cartables en couleurs, tabliers en tailles).
- Seeder les catégories (10), quelques sous-catégories, et des kits par classe
  pour au moins Élémentaire (CI→CM2).
- Seeder 3 zones : Dakar (moins cher), Thiès, Autres régions, avec tarifs 24h/6j
  provisoires à ajuster.
