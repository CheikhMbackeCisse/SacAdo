-- SacAdo — Corrige une ambiguïté PostgREST sur accueil_classement().
-- Constat (log serveur, 2026-09-30, juste après l'exécution de la migration 0102) :
-- « Could not choose the best candidate function between:
--    accueil_classement(p_limit, p_affinites, p_facteur)
--    accueil_classement(p_limit, p_affinites, p_facteur, p_offset) »
-- La version à 3 arguments aurait dû être supprimée par la migration 0093 (qui
-- fait exactement ce drop avant de créer la version à 4 arguments) — elle a dû
-- être recréée depuis, quelle qu'en soit la cause. Tant qu'elle existe,
-- lib/accueil.ts (qui appelle sans p_offset, argument à valeur par défaut) est
-- ambigu pour Postgres et l'app tombe en repli sur les "populaires" classiques,
-- qui ignorent les épinglages (classement_manuel) — y compris ceux de
-- PROMPT_CLIENT lot 1.
--
-- Idempotente. À exécuter dans le SQL Editor Supabase.

drop function if exists public.accueil_classement(int, jsonb, numeric);

-- ============================================================================
-- Contrôle post-exécution
-- ============================================================================
-- select pg_get_function_identity_arguments(oid) from pg_proc
-- where proname = 'accueil_classement';
-- -> une seule ligne : "p_limit integer, p_affinites jsonb, p_facteur numeric, p_offset integer"
