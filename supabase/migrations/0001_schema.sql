-- SacAdo — schéma initial (Lot 1)
-- Basé sur MODELE_DONNEES.md. À exécuter en premier (Supabase SQL Editor ou `supabase db push`).

-- ============================================================================
-- ZONES (créée avant clients/commandes qui la référencent)
-- ============================================================================
create table zones (
  id bigint generated always as identity primary key,
  nom text not null unique,
  tarif_5j integer not null check (tarif_5j >= 0),
  tarif_24h integer not null check (tarif_24h >= 0)
);

-- ============================================================================
-- PRODUITS
-- ============================================================================
create table produits (
  id bigint generated always as identity primary key,
  nom text not null,
  categorie text not null,
  prix integer not null check (prix >= 0),
  delai text not null check (delai in ('24h', '5j')),
  photo text,
  stock integer not null default 0 check (stock >= 0),
  seuil_alerte integer not null default 5 check (seuil_alerte >= 0),
  statut text not null default 'dispo' check (statut in ('dispo', 'sur_commande', 'epuise')),
  created_at timestamptz not null default now()
);

create index idx_produits_categorie on produits (categorie);

-- Statut auto : stock à 0 => "epuise" ; remonte à "dispo" si le stock revient
-- et que le produit était marqué épuisé (l'admin garde la main sur "sur_commande").
create function set_produit_statut() returns trigger as $$
begin
  if new.stock <= 0 then
    new.statut := 'epuise';
  elsif tg_op = 'UPDATE' and old.statut = 'epuise' and new.stock > 0 then
    new.statut := 'dispo';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_produits_statut
  before insert or update of stock on produits
  for each row execute function set_produit_statut();

-- ============================================================================
-- PRODUIT_VARIANTES
-- ============================================================================
create table produit_variantes (
  id bigint generated always as identity primary key,
  produit_id bigint not null references produits (id) on delete cascade,
  couleur text,
  taille text,
  prix integer check (prix >= 0),
  stock integer not null default 0 check (stock >= 0),
  statut text not null default 'dispo' check (statut in ('dispo', 'epuise')),
  photo text,
  created_at timestamptz not null default now(),
  unique (produit_id, couleur, taille)
);

create index idx_produit_variantes_produit on produit_variantes (produit_id);

create function set_variante_statut() returns trigger as $$
begin
  if new.stock <= 0 then
    new.statut := 'epuise';
  elsif tg_op = 'UPDATE' and old.statut = 'epuise' and new.stock > 0 then
    new.statut := 'dispo';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_produit_variantes_statut
  before insert or update of stock on produit_variantes
  for each row execute function set_variante_statut();

-- ============================================================================
-- KITS & KIT_ITEMS
-- ============================================================================
create table kits (
  id bigint generated always as identity primary key,
  cycle text not null check (cycle in ('prescolaire', 'elementaire', 'college', 'lycee')),
  niveau text not null,
  nom text not null,
  created_at timestamptz not null default now(),
  unique (cycle, niveau)
);

create table kit_items (
  id bigint generated always as identity primary key,
  kit_id bigint not null references kits (id) on delete cascade,
  produit_id bigint not null references produits (id) on delete restrict,
  quantite_defaut integer not null default 1 check (quantite_defaut > 0),
  unique (kit_id, produit_id)
);

create index idx_kit_items_kit on kit_items (kit_id);

-- ============================================================================
-- CLIENTS
-- ============================================================================
create table clients (
  id bigint generated always as identity primary key,
  nom text not null,
  telephone text not null unique,
  zone_id bigint references zones (id),
  date_creation timestamptz not null default now()
);

-- ============================================================================
-- COMMANDES & COMMANDE_ITEMS
-- ============================================================================
create table commandes (
  id bigint generated always as identity primary key,
  client_id bigint not null references clients (id),
  zone_id bigint not null references zones (id),
  adresse text,
  mode_livraison text not null check (mode_livraison in ('24h', '5j')),
  frais_livraison integer not null default 0 check (frais_livraison >= 0),
  -- enum extensible : "livraison" seul en v1, "wave"/"orange_money" ajoutables plus tard
  -- (ALTER TABLE ... DROP CONSTRAINT / ADD CONSTRAINT, pas de migration lourde)
  mode_paiement text not null default 'livraison' check (mode_paiement in ('livraison')),
  sous_total integer not null check (sous_total >= 0),
  total integer not null check (total >= 0),
  statut text not null default 'recue' check (statut in ('recue', 'preparation', 'livraison', 'livree')),
  date timestamptz not null default now()
);

create index idx_commandes_client on commandes (client_id);
create index idx_commandes_statut on commandes (statut);

create table commande_items (
  id bigint generated always as identity primary key,
  commande_id bigint not null references commandes (id) on delete cascade,
  produit_id bigint not null references produits (id),
  variante_id bigint references produit_variantes (id),
  quantite integer not null check (quantite > 0),
  prix_unitaire integer not null check (prix_unitaire >= 0)
);

create index idx_commande_items_commande on commande_items (commande_id);
create index idx_commande_items_produit on commande_items (produit_id);

-- ============================================================================
-- MESSAGES (boîte de réception)
-- ============================================================================
create table messages (
  id bigint generated always as identity primary key,
  client_id bigint not null references clients (id) on delete cascade,
  type text not null check (type in ('commande', 'info', 'promo')),
  titre text not null,
  corps text not null,
  lu boolean not null default false,
  date timestamptz not null default now()
);

create index idx_messages_client on messages (client_id);

-- Génère automatiquement un message "commande" à chaque changement de statut
-- d'une commande (voir MODELE_DONNEES.md : "génèrent automatiquement un message ici").
create function notify_commande_statut() returns trigger as $$
declare
  libelle text;
begin
  if tg_op = 'UPDATE' and new.statut = old.statut then
    return new;
  end if;

  libelle := case new.statut
    when 'recue' then 'Commande reçue'
    when 'preparation' then 'Commande en préparation'
    when 'livraison' then 'Commande en cours de livraison'
    when 'livree' then 'Commande livrée'
    else new.statut
  end;

  insert into messages (client_id, type, titre, corps)
  values (
    new.client_id,
    'commande',
    libelle,
    'Votre commande #' || new.id || ' est maintenant : ' || libelle || '.'
  );

  return new;
end;
$$ language plpgsql;

create trigger trg_commandes_notify
  after insert or update of statut on commandes
  for each row execute function notify_commande_statut();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
-- Catalogue (produits, variantes, kits, kit_items, zones) : lecture publique,
-- l'app cliente lit directement avec la clé anon. Écritures réservées au
-- back-office (service_role, utilisé côté serveur uniquement).
alter table produits enable row level security;
alter table produit_variantes enable row level security;
alter table kits enable row level security;
alter table kit_items enable row level security;
alter table zones enable row level security;

create policy "Lecture publique produits" on produits for select using (true);
create policy "Lecture publique produit_variantes" on produit_variantes for select using (true);
create policy "Lecture publique kits" on kits for select using (true);
create policy "Lecture publique kit_items" on kit_items for select using (true);
create policy "Lecture publique zones" on zones for select using (true);

-- Données personnelles (clients, commandes, commande_items, messages) : aucune
-- policy publique. Uniquement accessibles via service_role, depuis des routes
-- serveur Next.js (checkout, admin) — jamais depuis la clé anon exposée au client.
alter table clients enable row level security;
alter table commandes enable row level security;
alter table commande_items enable row level security;
alter table messages enable row level security;
