-- SacAdo — Bénéfice dans l'espace comptabilité (TACHE_corrections_2.md §2)
-- À exécuter APRÈS 0054, dans le SQL Editor Supabase. Additive + idempotente.
--
-- Bénéfice = encaissements − (dépenses + sommes reversées aux fournisseurs).
-- La part fournisseur se calcule à partir du PRIX D'ACHAT FIGÉ sur chaque ligne
-- de commande au moment de la vente (jamais le prix d'achat actuel du produit).

-- 1. Prix d'achat figé par ligne de commande.
alter table commande_items
  add column if not exists prix_achat_unitaire integer
  check (prix_achat_unitaire is null or prix_achat_unitaire >= 0);

-- 2. Dépenses : libellé obligatoire, lien commande facultatif, nouveau jeu de
--    catégories (livraison, wave, emballage, publicite, technique, autre).
alter table depenses add column if not exists libelle text;
alter table depenses
  add column if not exists commande_id bigint references commandes (id) on delete set null;

update depenses set categorie = case categorie
    when 'carburant'         then 'livraison'
    when 'salaire_chauffeur'  then 'autre'
    when 'achat_fournisseur'  then 'autre'
    when 'divers'             then 'autre'
    else categorie
  end
 where categorie in ('carburant', 'salaire_chauffeur', 'achat_fournisseur', 'divers');

update depenses
   set libelle = coalesce(nullif(btrim(note), ''), initcap(categorie))
 where libelle is null;

alter table depenses alter column libelle set not null;

alter table depenses drop constraint if exists depenses_categorie_check;
alter table depenses add constraint depenses_categorie_check
  check (categorie in ('livraison', 'wave', 'emballage', 'publicite', 'technique', 'autre'));

-- ============================================================================
-- Contrôles post-exécution
-- ============================================================================
-- select categorie, count(*) from depenses group by categorie;
-- select count(*) from commande_items where prix_achat_unitaire is not null;
