-- SacAdo — PROMPT_ADMIN_COMPTA_LOCALITES.md Lot 1 : remise à zéro de la
-- comptabilité (sauf commande n° 28), et interrupteur pérenne pour la suite.
-- À exécuter APRÈS 0112, dans le SQL Editor Supabase.
-- Idempotent : peut être relancé sans erreur.
--
-- Une commande "test" disparaît de la comptabilité, des statistiques, du
-- tableau de bord, des rapports, de Trafic, de "Mes commandes" côté client et
-- des files de préparation, mais reste consultable dans l'admin via un filtre
-- dédié. Elle n'affecte ni ses lignes (commande_items), ni le stock : seule
-- la commande elle-même porte le marqueur, tout ce qui en dépend est exclu
-- en lecture par une jointure sur ce booléen.

alter table commandes add column if not exists est_test boolean not null default false;

create index if not exists idx_commandes_est_test on commandes (est_test);
