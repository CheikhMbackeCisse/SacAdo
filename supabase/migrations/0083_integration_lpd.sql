-- SacAdo — Intégration du catalogue LPD (PROMPT_integration_LPD.md).
-- À exécuter après 0082, dans le SQL Editor Supabase. Idempotent.
--
-- Ce que fait cette migration :
--   1. `produits.gamme` : 'essentiel' (LPD) / 'premium' (Papex, plus tard) —
--      les deux niveaux de prix d'un même kit (§ Contexte du prompt).
--   2. `produits.unite_vente` : obligatoire avant publication (§ Règles
--      d'import n°5). Défaut 'inconnu' — jamais déduit d'un prix (§ Le piège
--      du conditionnement).
--   3. `produits.quantite_conditionnement` : nombre de pièces si paquet/lot.
--   4. `produits.equivalent_id` : lie un article LPD à son équivalent Papex
--      (auto-référence sur produits).
--   5. `produits.reference_fournisseur` : la `Ref` d'origine (S000, LIT-001,
--      NIO-3240…), conservée pour la traçabilité et pour rejouer l'import
--      sans doublon (§ Livrable attendu, idempotent + journalisé).
--   Les autres "champs à créer" du prompt existent déjà sous d'autres noms :
--   `fournisseur_id` -> `vendeur_id` (0036, vendeur = fournisseur unifié) ;
--   `statut` (disponible/rupture, posé à la main) -> `produits.statut`
--   (0001, plus jamais dérivé du stock depuis 0071).

-- ============================================================================
-- 1-4. Nouvelles colonnes
-- ============================================================================
alter table produits add column if not exists gamme text;
alter table produits add column if not exists unite_vente text not null default 'inconnu';
alter table produits add column if not exists quantite_conditionnement integer;
alter table produits add column if not exists equivalent_id bigint references produits (id) on delete set null;
alter table produits add column if not exists reference_fournisseur text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'produits_gamme_check') then
    alter table produits add constraint produits_gamme_check
      check (gamme is null or gamme in ('essentiel', 'premium'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'produits_unite_vente_check') then
    alter table produits add constraint produits_unite_vente_check
      check (unite_vente in ('unite', 'paquet', 'lot', 'inconnu'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'produits_quantite_conditionnement_check') then
    alter table produits add constraint produits_quantite_conditionnement_check
      check (quantite_conditionnement is null or quantite_conditionnement > 0);
  end if;
end $$;

-- Traçabilité + idempotence de l'import par fournisseur (un même vendeur ne
-- peut pas avoir deux fois la même référence ; NULL (produits hors import
-- fournisseur) reste libre autant de fois que nécessaire).
create unique index if not exists idx_produits_vendeur_reference_fournisseur
  on produits (vendeur_id, reference_fournisseur)
  where reference_fournisseur is not null;

-- ============================================================================
-- Contrôles post-exécution
-- ============================================================================
-- select column_name from information_schema.columns
--   where table_name = 'produits'
--     and column_name in ('gamme','unite_vente','quantite_conditionnement','equivalent_id','reference_fournisseur');
-- select unite_vente, count(*) from produits group by 1;
