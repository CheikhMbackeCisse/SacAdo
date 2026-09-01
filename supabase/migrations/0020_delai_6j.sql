-- SacAdo — Délai de livraison long : « 5 jours » devient « 6 jours »
-- À exécuter APRÈS 0019, dans le SQL Editor Supabase.
-- Idempotent : peut être relancé sans erreur.
--
-- CORRECTION_DELAI_LIVRAISON.md : les deux options de livraison deviennent
-- 24h et 6 jours (6j englobe toujours un jour de week-end). La logique de
-- calcul des frais ne change pas ; seul le libellé/la valeur passe de 5 à 6.

-- 1. zones : renommer le tarif long tarif_5j -> tarif_6j.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'zones' and column_name = 'tarif_5j'
  ) then
    alter table zones rename column tarif_5j to tarif_6j;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'zones_tarif_5j_check'
  ) then
    alter table zones rename constraint zones_tarif_5j_check to zones_tarif_6j_check;
  end if;
end $$;

-- 2. produits.delai : '5j' -> '6j' (données + contrainte).
alter table produits drop constraint if exists produits_delai_check;
update produits set delai = '6j' where delai = '5j';
alter table produits add constraint produits_delai_check check (delai in ('24h', '6j'));

-- 3. commandes.mode_livraison : '5j' -> '6j' (données + contrainte).
alter table commandes drop constraint if exists commandes_mode_livraison_check;
update commandes set mode_livraison = '6j' where mode_livraison = '5j';
alter table commandes
  add constraint commandes_mode_livraison_check check (mode_livraison in ('24h', '6j'));
