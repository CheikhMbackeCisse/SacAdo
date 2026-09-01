-- SacAdo — Marketplace V2, espace vendeur : boîte de réception vendeur
-- À exécuter APRÈS 0015, dans le SQL Editor Supabase.
-- Idempotent : peut être relancé sans erreur.
--
-- Les notifications vendeur (négociation de prix, publication, refus) ont besoin
-- d'une boîte de réception. La table `messages` existante est rattachée à
-- `client_id → clients` : les vendeurs n'y ont pas leur place. On crée une table
-- jumelle rattachée à `vendeur_id → vendeurs` (option A validée avec le fondateur).
--
-- Contrairement aux messages client (générés par trigger sur les commandes), les
-- messages vendeur sont insérés explicitement par les server actions de
-- négociation (le libellé dépend de l'action) via le service_role.

create table if not exists messages_vendeur (
  id bigint generated always as identity primary key,
  vendeur_id uuid not null references vendeurs (id) on delete cascade,
  -- 'negociation' : proposition / contre-proposition de prix ;
  -- 'publication' : produit publié ; 'refus' : produit non retenu.
  type text not null check (type in ('negociation', 'publication', 'refus', 'info')),
  titre text not null,
  corps text not null,
  -- Lien optionnel vers le produit concerné (pour un futur clic → fiche).
  produit_id bigint references produits (id) on delete set null,
  lu boolean not null default false,
  date timestamptz not null default now()
);

create index if not exists idx_messages_vendeur_vendeur on messages_vendeur (vendeur_id, date desc);

-- ============================================================================
-- RLS : un vendeur lit et marque comme lus SES messages uniquement.
-- ============================================================================
alter table messages_vendeur enable row level security;

drop policy if exists "Vendeur lit ses messages" on messages_vendeur;
create policy "Vendeur lit ses messages" on messages_vendeur
  for select using (auth.uid() = vendeur_id);

-- Le vendeur peut passer ses propres messages à lu = true (aucune autre
-- colonne modifiable ; l'insertion reste réservée au service_role).
drop policy if exists "Vendeur marque ses messages lus" on messages_vendeur;
create policy "Vendeur marque ses messages lus" on messages_vendeur
  for update using (auth.uid() = vendeur_id) with check (auth.uid() = vendeur_id);
