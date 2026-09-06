-- SacAdo — Préparation fournisseur : notifications + suivi récupération
-- Chantier « préparation fournisseurs », Lot 4.
-- À exécuter APRÈS 0038, dans le SQL Editor Supabase. Idempotent.
--
--   1. `demandes_preparation.recuperee_le` : l'admin marque la demande comme
--      récupérée une fois le livreur passé chez le fournisseur. « Prête, pas
--      récupérée » = ce que l'admin doit encore aller chercher.
--   2. `messages_vendeur` : nouveau type 'preparation' + lien vers la demande,
--      pour prévenir le vendeur/fournisseur dans sa boîte de réception.

alter table demandes_preparation add column if not exists recuperee_le timestamptz;

alter table messages_vendeur drop constraint if exists messages_vendeur_type_check;
alter table messages_vendeur add constraint messages_vendeur_type_check
  check (type in ('negociation', 'publication', 'refus', 'info', 'preparation'));

alter table messages_vendeur add column if not exists demande_preparation_id bigint
  references demandes_preparation (id) on delete set null;
