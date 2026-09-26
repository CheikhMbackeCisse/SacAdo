-- SacAdo — Kits scolaires v2 : import piloté par fichier (import-kits/kits.json).
-- Étend les tables existantes `kits`/`kit_items` (Lot 1) plutôt que de créer un
-- second mécanisme : le principe "aucun prix stocké" était déjà respecté, il ne
-- manquait que le slug, le statut de publication, et la structure d'affichage
-- (sections, regroupement, libellé du besoin, ordre). Idempotent.

-- ============================================================================
-- 1. `kits` : slug, statut, série, affichage, champs admin
-- ============================================================================
alter table kits add column if not exists slug text;
alter table kits add column if not exists serie text;
alter table kits add column if not exists ordre_gamme int;
alter table kits add column if not exists description text;
alter table kits add column if not exists description_si_aucune_cle_des_cracks text;
alter table kits add column if not exists ebook_offert boolean not null default true;
alter table kits add column if not exists type_source text;
alter table kits add column if not exists statut text not null default 'masque';
alter table kits add column if not exists source_interne text;
alter table kits add column if not exists manquants_connus jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'kits_statut_check') then
    alter table kits add constraint kits_statut_check check (statut in ('masque', 'publie'));
  end if;
end $$;

create unique index if not exists kits_slug_key on kits (slug) where slug is not null;

-- ============================================================================
-- 2. `kit_items` : affichage (libellé du besoin, groupe, section, coché,
--    ordre). Pas de colonne variante : le choix de couleur/variante se fait
--    côté client au clic "Ajouter au panier", jamais stocké sur la ligne.
-- ============================================================================
alter table kit_items add column if not exists libelle_besoin text;
alter table kit_items add column if not exists groupe_affichage text;
alter table kit_items add column if not exists section text not null default 'principal';
alter table kit_items add column if not exists coche_defaut boolean not null default true;
alter table kit_items add column if not exists ordre int not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'kit_items_section_check') then
    alter table kit_items add constraint kit_items_section_check
      check (section in ('principal', 'livres_proposes', 'option'));
  end if;
end $$;

-- Un même produit peut apparaître plusieurs fois dans un kit (ex: le même
-- cahier 200p pour Maths, Français, Histoire-géo...), chacun avec son propre
-- libellé_besoin : la contrainte d'unicité (kit_id, produit_id) du Lot 1 ne
-- tient plus. L'import remplace les lignes d'un kit en bloc (delete + insert),
-- donc aucune contrainte d'unicité de remplacement n'est nécessaire.
alter table kit_items drop constraint if exists kit_items_kit_id_produit_id_key;

create index if not exists idx_kit_items_kit_ordre on kit_items (kit_id, ordre);
