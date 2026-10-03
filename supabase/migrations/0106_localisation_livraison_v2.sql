-- SacAdo — PROMPT_CLIENT_V2 Lot 2 : « Localisation » à la place de
-- « Comment trouver ta porte ». À exécuter APRÈS 0105, dans le SQL Editor
-- Supabase. Idempotente.
--
-- Le checkout ne demande plus un champ libre pour guider le livreur : il
-- demande soit la position GPS du téléphone, soit un lien Google Maps collé
-- par le client. `lat`/`lng` existent déjà (migration 0021) ; seul le lien
-- Google Maps (gardé tel quel, y compris les liens courts maps.app.goo.gl,
-- pour qu'un simple clic ouvre l'app) est nouveau.

alter table commandes add column if not exists lien_localisation text;

-- ============================================================================
-- Contrôle post-exécution
-- ============================================================================
-- select column_name from information_schema.columns
--  where table_name = 'commandes' and column_name = 'lien_localisation';
