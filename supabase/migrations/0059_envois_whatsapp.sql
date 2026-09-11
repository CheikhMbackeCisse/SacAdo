-- SacAdo — Journal des envois WhatsApp (TACHE_whatsapp_admin.md §7)
-- À exécuter APRÈS 0058. Idempotente.
--
-- SacAdo n'envoie rien automatiquement : la fiche commande de l'admin ouvre
-- WhatsApp avec le texte prérempli, un humain relit et envoie, puis confirme
-- « Message envoyé ? » dans l'admin — ce qui écrit une ligne ici. Sert à ne pas
-- envoyer deux fois la même chose quand plusieurs personnes gèrent les commandes.

create table if not exists envois_whatsapp (
  id             bigint generated always as identity primary key,
  commande_id    bigint references commandes (id) on delete set null,
  client_id      bigint references clients (id) on delete set null,
  telephone      text not null,               -- numéro normalisé au moment de l'envoi
  code_modele    text,                        -- null pour un « message libre »
  contenu_envoye text not null,
  envoye_par     uuid,                        -- admins.user_id
  confirme       boolean not null default true,
  cree_le        timestamptz not null default now()
);

create index if not exists idx_envois_whatsapp_commande
  on envois_whatsapp (commande_id, cree_le desc);

alter table envois_whatsapp enable row level security;
-- Aucune policy publique : lecture / écriture réservées au service_role
-- (server actions admin).

-- ============================================================================
-- Contrôle post-exécution
-- ============================================================================
-- select commande_id, code_modele, cree_le from envois_whatsapp order by cree_le desc limit 20;
