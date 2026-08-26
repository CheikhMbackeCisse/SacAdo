# Base de données SacAdo — Lot 1

Schéma + données de démo, à exécuter dans cet ordre sur ton projet Supabase.

## 1. Exécuter les migrations

**Option A — SQL Editor (le plus simple, aucun outil à installer) :**

1. Va sur [supabase.com](https://supabase.com) → ton projet → **SQL Editor**.
2. Ouvre `migrations/0001_schema.sql`, colle tout le contenu, clique **Run**.
3. Ouvre `migrations/0002_seed.sql`, colle tout le contenu, clique **Run**.

**Option B — Supabase CLI**, si tu l'utilises déjà :

```bash
supabase link --project-ref <ton-project-ref>
supabase db push
```

## 2. Récupérer tes clés pour l'app

Dans **Project Settings → API** :

- `Project URL` → `NEXT_PUBLIC_SUPABASE_URL` dans `.env.local`
- `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY` dans `.env.local`

Copie `.env.local.example` en `.env.local` et renseigne ces deux valeurs.

> La clé `service_role` (accès complet, RLS ignoré) ne sera nécessaire qu'à
> partir du Lot 4 (checkout) et du Lot 6 (admin), pour les routes serveur qui
> écrivent des données client. Elle ne doit **jamais** être préfixée `NEXT_PUBLIC_`
> ni exposée au navigateur.

## 3. Vérifier que ça a marché

Dans le SQL Editor, lance :

```sql
select nom, categorie, prix, stock, statut
from produits
order by categorie, nom;
```

Tu dois voir ~34 produits, avec `statut = 'epuise'` pour la calculatrice
graphique Casio FX-CG50 (stock à 0, mis à jour automatiquement par un trigger).

Vérifie aussi les kits :

```sql
select k.nom, count(ki.id) as nb_articles
from kits k
left join kit_items ki on ki.kit_id = k.id
group by k.id, k.nom
order by k.niveau;
```

Tu dois voir 6 kits (CI à CM2), chacun avec 8 à 12 articles selon le niveau.

## Ce que contient le schéma

- **9 tables** : `zones`, `produits`, `produit_variantes`, `kits`, `kit_items`,
  `clients`, `commandes`, `commande_items`, `messages` — conformes à
  `MODELE_DONNEES.md`.
- **Statut produit/variante automatique** : un trigger force `statut = 'epuise'`
  dès que `stock <= 0`, et repasse à `'dispo'` si le stock revient (sans écraser
  un statut `'sur_commande'` choisi manuellement par l'admin).
- **Message auto en boîte de réception** : un trigger sur `commandes` insère un
  message dans `messages` à chaque changement de statut (Reçue → Préparation →
  Livraison → Livrée), comme demandé dans `MODELE_DONNEES.md`. C'est une
  anticipation légère du Lot 4/6 : centraliser cette règle en base évite de la
  dupliquer entre le futur flux de checkout et l'admin. Dis-moi si tu préfères
  que ce soit géré au niveau applicatif plutôt qu'en trigger.
- **Row Level Security activée sur toutes les tables** :
  - `produits`, `produit_variantes`, `kits`, `kit_items`, `zones` : lecture
    publique (`select` ouvert), car l'app cliente les lit directement avec la
    clé `anon`. Aucune écriture publique — seul `service_role` (routes serveur)
    pourra créer/modifier des produits, futur admin du Lot 6.
  - `clients`, `commandes`, `commande_items`, `messages` : **aucune policy
    publique**. Ces tables contiennent des données personnelles ; elles ne
    seront lisibles/écrivables que via `service_role`, depuis des routes
    serveur Next.js (jamais depuis le navigateur avec la clé `anon`). C'est un
    point de sécurité important qu'il ne faut pas assouplir sans y réfléchir.
- **`mode_paiement`** limité à `'livraison'` par une contrainte `CHECK` (pas un
  enum Postgres), pour pouvoir ajouter `'wave'`/`'orange_money'` plus tard avec
  un simple `ALTER TABLE ... DROP/ADD CONSTRAINT`, sans migration lourde.

## Données de démo

- 3 zones (Dakar, Thiès, Autres régions) avec tarifs 24h/5j provisoires.
- 34 produits sur les 9 catégories de fournitures (les "Kits scolaires" sont la
  10e catégorie de l'accueil, mais vivent dans la table `kits`, pas `produits`).
- 2 cas volontaires pour tester l'admin plus tard : le Kit Arduino est sous son
  seuil d'alerte (stock 3 ≤ seuil 5) ; la calculatrice graphique Casio FX-CG50
  est à stock 0 → statut `epuise` automatique.
- Variantes couleur sur les cartables/sacs à dos, variantes taille sur le
  tablier écolier.
- 6 kits Élémentaire (CI à CM2) avec un socle commun de fournitures, plus
  géométrie à partir du CE2 et calculatrice scientifique à partir du CM1.
- Aucun client/commande/message de démo : ces tables se peupleront au Lot 4
  (checkout) — pas de sens à en seeder avant que ce flux existe.
