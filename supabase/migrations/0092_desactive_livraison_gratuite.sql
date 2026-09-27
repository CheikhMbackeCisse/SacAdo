-- SacAdo — CORRECTIONS_V11 lot 1 : plus de livraison gratuite pour l'instant.
-- À exécuter APRÈS 0091, dans le SQL Editor Supabase. Idempotente.
--
-- Le code lit désormais valeur = '' comme "livraison gratuite désactivée"
-- (lib/parametres.ts, lib/supabase/queries.ts). Le réglage reste modifiable
-- depuis /admin/zones (case "Livraison gratuite activée") pour la remettre
-- plus tard avec un montant.

update parametres
set valeur = '', maj = now()
where cle = 'seuil_livraison_gratuite';

-- ============================================================================
-- Contrôle post-exécution
-- ============================================================================
-- select cle, valeur from parametres where cle = 'seuil_livraison_gratuite';
-- -> valeur doit être une chaîne vide.
