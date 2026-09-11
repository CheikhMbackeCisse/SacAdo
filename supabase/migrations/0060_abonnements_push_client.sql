-- SacAdo — Notifications push côté client (TACHE_notifications_client.md §3)
-- À exécuter APRÈS 0059. Idempotente.
--
-- Le client n'a pas de compte : son identité est (téléphone + jeton) remis à la
-- première commande. Un abonnement push est donc rattaché à `clients.id`. Un
-- même client peut avoir plusieurs abonnements (un par appareil) — on envoie à
-- tous. La push reste un canal d'appoint : boîte de réception + WhatsApp sont
-- les canaux sûrs (§1).

create table if not exists abonnements_push_client (
  id                   bigint generated always as identity primary key,
  client_id            bigint not null references clients (id) on delete cascade,
  endpoint             text not null unique,
  p256dh               text not null,
  auth                 text not null,
  user_agent           text,
  cree_le              timestamptz not null default now(),
  derniere_utilisation timestamptz
);

create index if not exists idx_abonnements_push_client_client
  on abonnements_push_client (client_id);

alter table abonnements_push_client enable row level security;
-- Aucune policy publique : lecture / écriture réservées au service_role
-- (server actions client identifiées par téléphone + jeton, envoi serveur).

-- ============================================================================
-- Contrôle post-exécution
-- ============================================================================
-- select client_id, count(*) from abonnements_push_client group by client_id;
