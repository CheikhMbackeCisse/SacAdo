-- SacAdo — Demandes de préparation fournisseur (NOTIFICATIONS_FOURNISSEURS.md)
-- Chantier « préparation fournisseurs », Lot 2 (côté admin).
-- À exécuter APRÈS 0036, dans le SQL Editor Supabase. Idempotent.
--
-- Une « demande de préparation » = l'admin dit à un vendeur (= fournisseur) quoi
-- préparer, regroupé par client. Les articles sont FIGÉS à la création (le bon de
-- préparation est un document) : on recopie nom produit / variante / client /
-- livraison au moment où la demande est créée.

create table if not exists demandes_preparation (
  id            bigint generated always as identity primary key,
  vendeur_id    uuid not null references vendeurs (id) on delete cascade,
  statut        text not null default 'a_preparer' check (statut in ('a_preparer', 'preparee')),
  -- 'manuel'   : l'admin a déclenché la demande ;
  -- 'auto_24h' : commande en livraison 24h -> notification automatique (Lot 5).
  declenchement text not null default 'manuel' check (declenchement in ('manuel', 'auto_24h')),
  note          text,
  cree_le       timestamptz not null default now(),
  preparee_le   timestamptz
);

create index if not exists idx_demandes_prep_vendeur on demandes_preparation (vendeur_id, cree_le desc);
create index if not exists idx_demandes_prep_statut on demandes_preparation (statut);

create table if not exists demande_preparation_items (
  id               bigint generated always as identity primary key,
  demande_id       bigint not null references demandes_preparation (id) on delete cascade,
  commande_id      bigint not null references commandes (id) on delete cascade,
  -- Une ligne de commande n'entre que dans UNE demande (unique) : sert à ne pas
  -- redemander deux fois la préparation du même article.
  commande_item_id bigint not null references commande_items (id) on delete cascade,
  produit_id       bigint references produits (id) on delete set null,
  quantite         integer not null check (quantite > 0),
  -- Instantané figé à la création :
  produit_nom      text not null,
  variante_label   text,
  produit_photo    text,
  client_nom       text not null,
  mode_livraison   text,
  zone_nom         text,
  note             text,
  unique (commande_item_id)
);

create index if not exists idx_demande_prep_items_demande on demande_preparation_items (demande_id);

alter table demandes_preparation enable row level security;
alter table demande_preparation_items enable row level security;
-- Lot 2 : aucune policy publique — accès service_role uniquement (server actions
-- admin). Lot 3 ouvrira une lecture restreinte par jeton pour le bon de
-- préparation côté vendeur.
