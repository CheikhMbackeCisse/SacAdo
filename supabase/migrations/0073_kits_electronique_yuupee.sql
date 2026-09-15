-- SacAdo — Kits électroniques assemblés (TACHE_kits_impression_classement.md
-- Chantier A). À exécuter APRÈS 0072, dans le SQL Editor Supabase. Idempotent.
--
-- Ce que fait cette migration :
--   1. `produits.est_kit` / `niveau_difficulte` / `notice_url`.
--   2. `composition_kit` : nouvelle table, PAS une réutilisation de l'existant
--      `kits`/`kit_items` (0001_schema.sql) — ces deux tables restent le
--      mécanisme des kits scolaires par classe (`kits.cycle`/`niveau`,
--      `kit_items.kit_id -> kits.id`), une entité séparée sans prix ni fiche
--      produit propres. Un kit électronique, lui, EST un produit vendable à
--      part entière (fiche, prix, panier) — `composition_kit.kit_id`
--      référence donc `produits(id)`, pas `kits(id)`. Même forme que
--      `kit_items` (parent, composant, quantité), cible différente : pas un
--      second mécanisme concurrent, un mécanisme frère pour une entité différente.

alter table produits add column if not exists est_kit boolean not null default false;
alter table produits add column if not exists niveau_difficulte text; -- 'debutant' | 'intermediaire' | 'avance'
alter table produits add column if not exists notice_url text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'produits_niveau_difficulte_check'
  ) then
    alter table produits add constraint produits_niveau_difficulte_check
      check (niveau_difficulte is null or niveau_difficulte in ('debutant', 'intermediaire', 'avance'));
  end if;
end $$;

create table if not exists composition_kit (
  kit_id bigint not null references produits(id) on delete cascade,
  composant_id bigint not null references produits(id),
  quantite int not null default 1 check (quantite > 0),
  primary key (kit_id, composant_id)
);
create index if not exists composition_kit_composant_idx on composition_kit (composant_id);

-- ============================================================================
-- Contrôles post-exécution (à lancer après la migration)
-- ============================================================================
-- select column_name from information_schema.columns
--   where table_name = 'produits' and column_name in ('est_kit','niveau_difficulte','notice_url');
-- select * from composition_kit limit 5;
