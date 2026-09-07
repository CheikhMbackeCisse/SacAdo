-- SacAdo — Unification vendeur = fournisseur (NOTE_UNIFICATION_VENDEUR_FOURNISSEUR.md)
-- Chantier « préparation fournisseurs », Lot 1 (socle modèle).
-- À exécuter APRÈS 0035, dans le SQL Editor Supabase. Idempotent : peut être relancé.
--
-- Ce que fait cette migration :
--   1. `vendeurs` : compte auth devient OPTIONNEL (colonne `user_id`), on ajoute
--      un point de retrait (adresse / lat / lng) et un drapeau `actif`.
--   2. Un vendeur « SacAdo » (id fixe connu) pour les produits en propre :
--      tous les produits sans vendeur y sont rattachés.
--   3. `produits.publie_par` : distingue « publié par l'admin » (en ligne direct)
--      de « soumis par un vendeur » (passe par la validation).
--   4. Les lignes de `fournisseurs` (0028) sont recopiées dans `vendeurs`. La
--      table `fournisseurs` reste en base (lecture abandonnée côté app) et sera
--      supprimée dans un lot ultérieur, une fois tout vérifié.

-- ============================================================================
-- 1. VENDEURS : compte optionnel + point de retrait
-- ============================================================================

-- Compte de connexion facultatif. NULL = vendeur géré par l'admin, sans login.
-- On ne reprend l'id comme user_id que pour les lignes qui SONT un compte auth
-- (les vendeurs marketplace existants). Le vendeur « SacAdo » et les fournisseurs
-- recopiés n'ont pas de compte -> user_id reste NULL. Écrit ainsi, le script est
-- rejouable même après une exécution partielle.
alter table vendeurs add column if not exists user_id uuid;
update vendeurs set user_id = id
where user_id is null
  and exists (select 1 from auth.users u where u.id = vendeurs.id);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'vendeurs_user_id_fkey'
  ) then
    alter table vendeurs
      add constraint vendeurs_user_id_fkey
      foreign key (user_id) references auth.users (id) on delete set null;
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'vendeurs_user_id_key'
  ) then
    alter table vendeurs add constraint vendeurs_user_id_key unique (user_id);
  end if;
end $$;

-- L'id n'est plus forcément un compte auth : on retire la FK vers auth.users et
-- on donne un défaut pour les vendeurs créés par l'admin (sans compte).
-- On cherche la contrainte par sa définition (le nom auto peut varier).
do $$
declare
  nom_contrainte text;
begin
  select c.conname into nom_contrainte
  from pg_constraint c
  where c.conrelid = 'vendeurs'::regclass
    and c.contype = 'f'
    and c.confrelid = 'auth.users'::regclass
    and c.conkey = array[
      (select attnum from pg_attribute where attrelid = 'vendeurs'::regclass and attname = 'id')
    ];
  if nom_contrainte is not null then
    execute format('alter table vendeurs drop constraint %I', nom_contrainte);
  end if;
end $$;

alter table vendeurs alter column id set default gen_random_uuid();

-- Point de retrait de la marchandise (repris de `fournisseurs`).
alter table vendeurs add column if not exists adresse text;
alter table vendeurs add column if not exists lat double precision;
alter table vendeurs add column if not exists lng double precision;
alter table vendeurs add column if not exists actif boolean not null default true;

-- Les policies RLS existantes (`auth.uid() = id`) restent valides : à l'inscription
-- la fiche est créée avec id = auth.users.id (inchangé). Un vendeur sans compte
-- ne se connecte jamais, il n'est jamais soumis au RLS `authenticated`.

-- ============================================================================
-- 2. VENDEUR « SacAdo » + rattachement des produits en propre
-- ============================================================================
-- Id fixe connu, repris en code : lib/vendeurs/constants.ts (VENDEUR_SACADO_ID).
insert into vendeurs (id, nom_boutique, actif)
values ('00000000-0000-0000-0000-000000000001', 'SacAdo', true)
on conflict (id) do nothing;

update produits
set vendeur_id = '00000000-0000-0000-0000-000000000001',
    statut_publication = 'publie'
where vendeur_id is null;

-- ============================================================================
-- 3. PRODUITS : qui a publié
-- ============================================================================
--   'admin'   : publié par l'admin au nom d'un vendeur -> en ligne direct.
--   'vendeur' : soumis par le vendeur via son compte  -> validation admin.
alter table produits add column if not exists publie_par text not null default 'admin';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'produits_publie_par_check'
  ) then
    alter table produits add constraint produits_publie_par_check
      check (publie_par in ('admin', 'vendeur'));
  end if;
end $$;

-- Backfill : les produits actuellement rattachés à un vrai vendeur (≠ SacAdo)
-- viennent forcément d'une soumission vendeur.
update produits
set publie_par = 'vendeur'
where vendeur_id is not null
  and vendeur_id <> '00000000-0000-0000-0000-000000000001'
  and publie_par <> 'vendeur';

-- ============================================================================
-- 4. FUSION fournisseurs -> vendeurs
-- ============================================================================
-- Chaque fournisseur (0028) devient un vendeur sans compte, avec son point de
-- retrait. Rapprochement par nom (insensible à la casse) pour rester idempotent.
insert into vendeurs (nom_boutique, adresse, lat, lng, actif)
select f.nom, f.adresse, f.lat, f.lng, true
from fournisseurs f
where not exists (
  select 1 from vendeurs v where lower(v.nom_boutique) = lower(f.nom)
);

-- La table `fournisseurs` n'est PAS supprimée ici (filet de sécurité). Plus
-- aucune lecture applicative ne la vise après cette migration.
