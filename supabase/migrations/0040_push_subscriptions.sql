-- SacAdo — Notifications push (PWA) pour l'espace vendeur / fournisseur
-- Chantier « préparation fournisseurs », Lot 5 (push).
-- À exécuter APRÈS 0039, dans le SQL Editor Supabase. Idempotent.
--
-- Un vendeur qui a un compte peut activer les notifications push : le navigateur
-- crée un abonnement (endpoint + clés) qu'on stocke ici. À chaque demande de
-- préparation, le serveur envoie une notif à tous les abonnements du vendeur.
-- La push est un canal d'appoint (NOTIFICATIONS_FOURNISSEURS §1) : in-app +
-- WhatsApp restent les canaux sûrs.

create table if not exists push_subscriptions (
  id         bigint generated always as identity primary key,
  vendeur_id uuid not null references vendeurs (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  cree_le    timestamptz not null default now()
);

create index if not exists idx_push_subscriptions_vendeur on push_subscriptions (vendeur_id);

alter table push_subscriptions enable row level security;
-- Aucune policy publique : lecture / écriture réservées au service_role
-- (server actions vendeur + envoi serveur).
