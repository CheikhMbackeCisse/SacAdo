-- SacAdo — PROMPT_ADMIN_V2 Lot 4 : éditeur « À découvrir ». À exécuter APRÈS
-- 0109, dans le SQL Editor Supabase. Idempotente.
--
-- Pas de nouvelle table pour l'épinglage lui-même : l'éditeur réutilise
-- `classement_manuel` (position/exclu), déjà en place pour /admin/classement
-- (TACHE_algorithme_classement.md §6.4). Seule nouveauté : un journal (qui,
-- quand) des enregistrements faits depuis ce nouvel écran.

create table if not exists journal_decouvrir (
  id            bigint generated always as identity primary key,
  admin_user_id uuid not null references admins (user_id),
  maj_le        timestamptz not null default now(),
  resume        text not null
);

alter table journal_decouvrir enable row level security;
-- Aucune policy publique : lecture/écriture réservées au service_role (admin).

create index if not exists idx_journal_decouvrir_maj_le on journal_decouvrir (maj_le desc);

-- ============================================================================
-- Contrôles post-exécution
-- ============================================================================
-- 1. select * from journal_decouvrir order by maj_le desc limit 5;
-- 2. Enregistrer un changement depuis /admin/decouvrir -> une ligne apparaît,
--    avec l'admin connecté et un résumé lisible.
