-- SacAdo — Documents téléchargeables : notices de montage des kits électroniques
-- (TACHE_documents_telechargeables.md, lot 1 : schéma).
-- À exécuter APRÈS 0076, dans le SQL Editor Supabase. Idempotent.
--
-- Portée de ce chantier : UNIQUEMENT les notices de montage des kits
-- électroniques Yuupee (accès `apres_achat`, rattaché à un produit). Le
-- système d'ebooks scolaires offerts (tables `ebooks` / `ebook_classes`,
-- clé cycle/niveau) est un mécanisme distinct, déjà en prod, non touché ici
-- (décision explicite : pas de fusion, voir mémoire session).
--
-- Différences volontaires avec le document source :
--   - `client_id`/`commande_id`/`produit_id` en bigint (schéma réel SacAdo),
--     pas de colonne `utilisateur_id` uuid : ce projet n'a pas de compte
--     client (identité = téléphone + jeton HMAC, voir lib/client-auth.ts).
--   - Pas de fonction SQL `peut_telecharger` : le contrôle d'accès dépend du
--     jeton HMAC, connu seulement côté application, pas de Postgres. La
--     vérification se fait dans une server action (lot 3), sur le même
--     modèle que `lib/ebooks/actions.ts`.
--   - Colonnes `nombre_pages`, `apercu_texte`, `materiel_supplementaire`
--     ajoutées à `documents` : nécessaires à l'aperçu public sur la fiche
--     produit (§5 du document source), absentes du schéma générique fourni.

-- ============================================================================
-- TABLES
-- ============================================================================
create table if not exists documents (
  id                      bigint generated always as identity primary key,
  titre                   text not null,
  type                    text not null default 'notice' check (type in ('notice', 'guide')),
  chemin_fichier          text not null,        -- chemin de l'objet dans le bucket privé `documents`
  taille_ko               int,
  acces                   text not null default 'apres_achat' check (acces in ('libre', 'apres_achat')),
  apercu_url              text,                 -- photo du montage terminé, publique
  nombre_pages            int,
  apercu_texte            text,                 -- "ce qu'on apprend", 3-4 lignes
  materiel_supplementaire text,                 -- matériel nécessaire en plus du kit, s'il y en a
  actif                   boolean not null default true,
  cree_le                 timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create table if not exists documents_produits (
  document_id bigint not null references documents (id) on delete cascade,
  produit_id  bigint not null references produits (id) on delete cascade,
  primary key (document_id, produit_id)
);

create index if not exists idx_documents_produits_produit on documents_produits (produit_id);

create table if not exists telechargements (
  id           bigint generated always as identity primary key,
  document_id  bigint not null references documents (id),
  client_id    bigint references clients (id),
  commande_id  bigint references commandes (id),
  cree_le      timestamptz not null default now()
);

create index if not exists idx_telechargements_document on telechargements (document_id, cree_le desc);
create index if not exists idx_telechargements_client on telechargements (client_id);

-- ============================================================================
-- updated_at automatique sur `documents` (trace le remplacement du fichier)
-- ============================================================================
create or replace function set_document_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_documents_updated_at on documents;
create trigger trg_documents_updated_at
  before update on documents
  for each row execute function set_document_updated_at();

-- ============================================================================
-- RLS
-- ============================================================================
-- `documents` / `documents_produits` : lecture publique des colonnes d'aperçu
-- uniquement — le storefront (fiche produit) affiche titre/nombre de pages/
-- aperçu/matériel avant achat (§5 du document source). `chemin_fichier` n'est
-- JAMAIS demandé par les requêtes publiques (liste de colonnes explicite côté
-- code, même convention que COLONNES_PRODUIT_PUBLIC dans lib/supabase/queries.ts)
-- mais reste techniquement lisible par la clé anon : ne pas y mettre de secret.
-- Sans cette policy, le bloc "notice" resterait vide en silence côté client
-- (piège déjà rencontré sur composition_kit, migration 0075).
alter table documents          enable row level security;
alter table documents_produits enable row level security;

drop policy if exists documents_lecture_publique on documents;
create policy documents_lecture_publique on documents
  for select using (actif);

drop policy if exists documents_produits_lecture_publique on documents_produits;
create policy documents_produits_lecture_publique on documents_produits
  for select using (true);

-- `telechargements` : aucun accès public. Écriture et lecture uniquement via
-- service_role (server action de téléchargement + stats admin).
alter table telechargements enable row level security;

-- ============================================================================
-- STOCKAGE : bucket PRIVÉ `documents`
-- ============================================================================
-- Comme `ebooks` : upload et URL signée passent par service_role uniquement,
-- aucune policy anon/authenticated. Le chemin ne doit jamais apparaître côté
-- client (§3 du document source).
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;
