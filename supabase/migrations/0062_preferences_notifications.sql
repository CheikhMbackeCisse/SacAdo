-- SacAdo — Préférences de notifications côté client (TACHE_notifications_client.md §8)
-- À exécuter APRÈS 0061. Idempotente.
--
-- Trois familles, jamais un seul interrupteur global. Absence de ligne = valeurs
-- par défaut (tout activé) : pas besoin de pré-créer une ligne pour chaque client.
-- Ne vaut que pour le PUSH — les messages WhatsApp de service (problème sur une
-- commande) partent toujours (§8, dernier paragraphe).

create table if not exists preferences_notifications (
  client_id          bigint primary key references clients (id) on delete cascade,
  suivi_commandes    boolean not null default true,
  produits_attendus  boolean not null default true,
  rentree_nouveautes boolean not null default true,
  maj_le             timestamptz not null default now()
);

alter table preferences_notifications enable row level security;
-- Aucune policy publique : lecture/écriture réservées au service_role
-- (server actions client identifiées par téléphone + jeton).

-- ============================================================================
-- Contrôle post-exécution
-- ============================================================================
-- select * from preferences_notifications limit 20;
