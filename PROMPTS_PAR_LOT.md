# SacAdo — Prompts de build pour Claude Code (par lot)

Construis dans l'ordre. Chaque lot est testable seul avant de passer au suivant.
Avant de commencer, place `CLAUDE.md` et `MODELE_DONNEES.md` à la racine du repo.
Active tes skills UI/UX et le MCP 21st.dev dès le lot 1.

Ne colle qu'UN lot à la fois. Vérifie que ça tourne, puis passe au suivant.

---

## LOT 0 — Mise en place

```
Lis CLAUDE.md et MODELE_DONNEES.md à la racine. C'est le contexte complet du projet.

Initialise le projet SacAdo :
- Next.js (App Router) + TypeScript + Tailwind CSS.
- Configure la palette de CLAUDE.md comme tokens Tailwind (bleu #0B3D91, blanc
  #FEFDFF, noir #001314, orange #E07B39, vert #16A34A, turquoise #64B6AC).
- Prépare la connexion Supabase (client + variables d'environnement, sans exposer
  de secrets ; explique-moi où mettre mes clés).
- Mets en place la structure de dossiers : app/, components/, lib/, public/images/.
- Configure la PWA (manifeste + service worker) ; l'app doit être installable.
  Icône = /public/images/logo.png (placeholder pour l'instant).
- Crée un composant de layout avec le Header (fond blanc, logo gauche, recherche
  centrale à placeholder rotatif, cœur droite) et la Bottom Nav (fond blanc, 5
  entrées, actif en bleu) selon les règles UI de CLAUDE.md.

Ne code pas encore les pages métier. Montre-moi l'app qui démarre avec le layout,
le header et la nav corrects. Explique comment lancer en local.
```

---

## LOT 1 — Base de données & seed

```
En te basant sur MODELE_DONNEES.md, crée le schéma Supabase complet :
tables produits, produit_variantes, kits (avec cycle + niveau), kit_items, clients,
zones, commandes, commande_items (avec variante_id nullable), messages.

Ajoute :
- Les contraintes et clés étrangères.
- La logique de statut produit (stock 0 => "epuise").
- Un script de seed avec des DONNÉES DE DÉMO réalistes (voir MODELE_DONNEES.md,
  section "Données de démo") : ~30 produits, dont quelques-uns à variantes,
  10 catégories, sous-catégories, kits Élémentaire CI→CM2, 3 zones (Dakar moins
  cher, Thiès, Autres régions).

Donne-moi les migrations SQL et le script de seed, et explique comment les exécuter
sur Supabase. Montre une requête de test qui liste les produits avec leur statut.
```

---

## LOT 2 — Catalogue (accueil, catégories, produit)

```
Construis la partie catalogue côté client, en suivant les règles UI de CLAUDE.md.

1. ACCUEIL : carrousel pub (auto-slide, swipeable) ; grille catégories 2 rangées ×
   5 colonnes en scroll horizontal (3 colonnes visibles + amorce de la 4e) ; section
   "Populaires" en grille produit 2 colonnes compacte.
2. LISTE PRODUITS (par catégorie) : rangée de sous-catégories illustrées en haut
   (façon SHEIN), barre de filtres, grille 2 colonnes. Rupture => carte grisée
   "Épuisé".
3. FICHE PRODUIT : galerie photos ; sélecteur de variantes couleur + taille (stock
   par variante, combinaisons indisponibles grisées) ; quantité ; bouton orange
   "Ajouter au panier" ; section "Vous aimerez aussi".
4. RECHERCHE : la barre du header filtre les produits par nom.

Les données viennent de Supabase. Le prix s'affiche en taille discrète, format
"12 500 FCFA". Favoris (cœur) et "déjà consultés" stockés en local (localStorage /
IndexedDB), sans compte. Montre-moi ces écrans fonctionnels avec les données de démo.
```

---

## LOT 3 — Kits (cycle → classe → kit)

```
Construis le parcours Kits, selon CLAUDE.md.

1. Quand on tape la catégorie "Kits scolaires", ouvrir l'écran CYCLE :
   4 cartes (Préscolaire, Élémentaire, Collège, Lycée).
2. Sélectionner un cycle révèle les CLASSES de ce cycle (chips).
3. Sélectionner une classe ouvre l'ÉCRAN KIT : liste des articles PRÉ-COCHÉE, avec
   case à cocher, miniature, nom, stepper de quantité, prix unitaire. L'utilisateur
   décoche ce qu'il a déjà, ajuste les quantités.
4. Résumé collant en bas : "X articles sélectionnés", total en direct, bouton orange
   "Ajouter le kit au panier".

Les kits et leurs items viennent de Supabase (table kits filtrée par cycle+niveau,
kit_items). Montre-moi le parcours complet avec les kits de démo (Élémentaire).
```

---

## LOT 4 — Panier & commande

```
Construis le panier et le checkout, selon CLAUDE.md.

1. PANIER : liste des articles (miniature, nom, prix, stepper, supprimer, total
   ligne) ; BARRE DE PROGRESSION vers la livraison gratuite à 50 000 FCFA
   ("Ajoutez X FCFA pour la livraison gratuite", barre en orange ; message vert
   quand le seuil est atteint) ; sous-total, frais de livraison, total ; bouton
   orange "Commander".
2. CHECKOUT : formulaire coordonnées (nom, téléphone WhatsApp = identifiant client,
   zone de livraison en dropdown, adresse/point de repère) ; choix mode de livraison
   (24h payant / 5j) en cartes sélectionnables ; PAIEMENT À LA LIVRAISON (afficher
   les logos Wave/OM à titre informatif seulement, aucune intégration) ;
   récapitulatif ; bouton orange "Confirmer la commande".

Logique métier (voir MODELE_DONNEES.md) :
- Frais de livraison calculés selon la zone (Dakar le moins cher) et le mode (24h/5j).
- Si sous-total ≥ 50 000 FCFA => frais = 0.
- À la confirmation : créer/retrouver le client par son numéro, créer la commande
  et les commande_items (avec variante_id si applicable, prix_unitaire figé),
  décrémenter le stock, insérer un message "commande reçue" dans la boîte de
  réception du client.
3. SUIVI : après commande, écran de suivi avec stepper Reçue → En préparation →
   En livraison → Livrée (étape Livrée en vert).

Montre-moi une commande de bout en bout avec les données de démo.
```

---

## LOT 5 — Espace "Moi" & boîte de réception

```
Construis l'espace client "Moi", selon CLAUDE.md.

- Page MOI (hub) : entrées Mes commandes, Boîte de réception, Favoris, Déjà
  consultés, Assistance. Header avec icône Paramètres en haut à droite.
- MES COMMANDES : historique des commandes du client (retrouvées par numéro),
  chacune ouvre l'écran de suivi.
- BOÎTE DE RÉCEPTION : liste des messages (table messages), non-lus en évidence,
  ouverture marque comme lu. Les mises à jour de statut de commande y apparaissent
  automatiquement.
- FAVORIS : produits mis en cœur (stockage local).
- DÉJÀ CONSULTÉS : produits récemment vus (stockage local, garder les 20 derniers).
- ASSISTANCE : page de contact simple (FAQ + moyen de contact).
- PARAMÈTRES : langue, infos compte, politique de confidentialité, déconnexion
  (structure simple, la langue peut être un simple placeholder en v1).
- BANNIÈRE D'INSTALLATION PWA : au premier passage, bannière discrète en bas
  "Installez SacAdo sur votre téléphone" + bouton Installer.

Montre-moi l'espace Moi complet avec les données de démo.
```

---

## LOT 6 — Interface admin

```
Construis l'interface d'administration, derrière une SEULE connexion admin
(Supabase Auth, email + mot de passe). Selon CLAUDE.md et MODELE_DONNEES.md.

Fonctions :
- CONNEXION admin sécurisée.
- PRODUITS : ajouter / modifier / supprimer (nom, catégorie, prix, délai 24h/5j,
  photo, stock, seuil d'alerte, statut) ; gestion des VARIANTES (couleur/taille,
  stock par variante).
- ALERTE STOCK BAS : mettre en évidence les produits sous leur seuil d'alerte.
- KITS : créer/éditer les kits (cycle + niveau) et leurs items.
- ZONES : gérer les tarifs de livraison (24h/5j) par zone, sans toucher au code.
- COMMANDES : liste filtrable par statut ; changer le statut en un clic (ce qui
  insère automatiquement un message dans la boîte de réception du client).
- VUE "ARTICLES VENDUS" (cumulé) : somme des quantités par produit ("72 gommes,
  31 kits CE2, 14 calculatrices"). Sert à savoir quoi racheter.
- VUE "COMMANDES PAR CLIENT" : filtrer par client (via téléphone), voir ses articles,
  montants, statuts, tout son historique.
- TABLEAU DE BORD : CA du jour, nombre de commandes, panier moyen, top produits,
  alertes stock.

L'ajout d'articles doit être simple et rapide (c'est utilisé souvent). Montre-moi
l'admin complet fonctionnel avec les données de démo.
```

---

## LOT 7 — Finitions & PWA

```
Finalise :
- Vérifie que la PWA s'installe bien (manifeste, icône = logo, service worker,
  fonctionne hors-ligne pour les écrans déjà visités).
- Optimise le chargement des images (lazy loading, compression, formats adaptés
  aux connexions mobiles lentes).
- Vérifie la cohérence de la palette partout (bleu marque, orange uniquement sur
  les actions d'achat, vert sur les statuts).
- Vérifie le responsive desktop (header, nav en barre haute/latérale, grille 4–6
  colonnes).
- Ajoute les états vides propres (panier vide, aucune commande, aucun favori).
- Vérifie les séparations visuelles header/contenu/nav.

Donne-moi une checklist de ce qui est prêt et de ce qui reste avant mise en ligne.
```

---

## Après les lots : mise en ligne
Quand tout tourne en local, demande à Claude Code de te guider pour :
- déployer le front sur Vercel,
- connecter la base Supabase de production,
- remplacer les données de démo par tes vrais produits via l'admin,
- brancher ton vrai logo et tes vraies images compressées.
