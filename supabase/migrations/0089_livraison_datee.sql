-- SacAdo — maj-accueil/PROMPT-maj-accueil-livraison.md §7
-- « Livraison 6 jours » devient « Livraison à une date donnée ». Les tarifs
-- (zones.tarif_24h / tarif_6j) et les valeurs internes '24h'/'6j' de
-- produits.delai et commandes.mode_livraison NE CHANGENT PAS : seul
-- l'affichage change, en calculant une date précise (lib/checkout/date-livraison.ts).
-- À exécuter dans le SQL Editor Supabase. Additive + idempotente.

-- ============================================================================
-- 1. Date de livraison figée sur la commande (calculée à la création, pour
--    filtrer/préparer la tournée en admin sans recalculer plus tard).
-- ============================================================================
alter table commandes add column if not exists date_livraison_prevue date;

create index if not exists idx_commandes_date_livraison_prevue
  on commandes (date_livraison_prevue)
  where date_livraison_prevue is not null;

-- ============================================================================
-- 2. Dates fermées (jours fériés, Magal, Tabaski...) : si la date calculée
--    tombe sur une de ces dates, on avance à la prochaine date ouverte.
-- ============================================================================
create table if not exists dates_fermees (
  date  date primary key,
  motif text
);

alter table dates_fermees enable row level security;

-- ============================================================================
-- Contrôle post-exécution
-- ============================================================================
-- select count(*) from commandes where mode_livraison = '6j' and date_livraison_prevue is null;
-- select * from dates_fermees order by date;
