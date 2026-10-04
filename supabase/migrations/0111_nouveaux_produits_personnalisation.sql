-- SacAdo — Lot nouveaux produits (Karbi, MedWorld, Seye, papiers) :
-- classement secondaire (« Aussi visible dans ») + option de personnalisation
-- payante. À exécuter APRÈS 0110, dans le SQL Editor Supabase. Idempotente.

-- 1. Sous-catégories manquantes.
-- "Matériel géométrique" (categorie_id 4) existe déjà mais n'avait encore
-- aucune sous-catégorie propre : les produits de géométrie restent classés
-- dans "Fournitures d'école" (classement principal, inchangé) et deviennent
-- aussi visibles ici via produit_classements_secondaires (§2).
insert into sous_categories (nom, slug, categorie_id, ordre)
select v.nom, v.slug, 4, v.ordre
from (values
  ('Compas', 'compas', 1),
  ('Rapporteurs', 'rapporteurs', 2),
  ('Règles', 'regles', 3),
  ('Équerres', 'equerres', 4),
  ('Kits de traçage', 'kits-tracage', 5)
) as v(nom, slug, ordre)
where not exists (
  select 1 from sous_categories s where s.categorie_id = 4 and s.slug = v.slug
);

-- Blouses de laboratoire (MedWorld), sous "Fournitures d'école" (categorie_id 11).
insert into sous_categories (nom, slug, categorie_id, ordre)
select 'Blouses de laboratoire', 'blouses-laboratoire', 11,
  coalesce((select max(ordre) + 1 from sous_categories where categorie_id = 11), 1)
where not exists (
  select 1 from sous_categories where categorie_id = 11 and slug = 'blouses-laboratoire'
);

-- 2. Classement secondaire : un produit garde un seul classement principal
-- (categorie_id/sous_categorie_id sur `produits`) mais peut apparaître AUSSI
-- dans d'autres rayons (ex. un compas reste classé "Fournitures d'école" et
-- apparaît aussi dans "Matériel géométrique"). sous_categorie_id peut être
-- NULL : visible au niveau de la catégorie entière, sans onglet précis.
create table if not exists produit_classements_secondaires (
  id bigint generated always as identity primary key,
  produit_id bigint not null references produits (id) on delete cascade,
  categorie_id bigint not null references categories (id) on delete cascade,
  sous_categorie_id bigint references sous_categories (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (produit_id, categorie_id, sous_categorie_id)
);
create index if not exists idx_classements_secondaires_categorie
  on produit_classements_secondaires (categorie_id, sous_categorie_id);
create index if not exists idx_classements_secondaires_produit
  on produit_classements_secondaires (produit_id);

alter table produit_classements_secondaires enable row level security;
drop policy if exists "Lecture publique classements secondaires" on produit_classements_secondaires;
create policy "Lecture publique classements secondaires" on produit_classements_secondaires
  for select using (true);

-- 3. Option de personnalisation payante (blouse de laboratoire MedWorld :
-- nom + spécialité brodés, +2 500 FCFA). Générique pour tout futur produit du
-- même genre, mais un seul couple de champs (« Nom » / « Spécialité ») : pas
-- de schéma de champs dynamique, ça resterait de la sur-ingénierie pour un
-- unique produit à ce jour.
alter table produits add column if not exists personnalisable boolean not null default false;
alter table produits add column if not exists prix_personnalisation integer check (prix_personnalisation is null or prix_personnalisation >= 0);
alter table produits add column if not exists achat_personnalisation integer check (achat_personnalisation is null or achat_personnalisation >= 0);

-- Texte choisi par le client, figé sur la ligne de commande comme le reste
-- (kit_*, prix_achat_unitaire...). NULL = pas de personnalisation sur cette ligne.
alter table commande_items add column if not exists personnalisation_nom text;
alter table commande_items add column if not exists personnalisation_specialite text;

-- 4. creer_commande() et ajouter_a_commande() : identiques à 0105 / 0107,
-- seules les deux colonnes de personnalisation sont ajoutées à l'insertion
-- dans commande_items (p_lignes porte déjà des champs optionnels, comme les
-- champs kit_* — aucun changement de signature nécessaire).

create or replace function creer_commande(
  p_client_id bigint,
  p_zone_id bigint,
  p_adresse text,
  p_mode_livraison text,
  p_frais_livraison integer,
  p_sous_total integer,
  p_total integer,
  p_reference text,
  p_lignes jsonb,
  p_lat double precision default null,
  p_lng double precision default null,
  p_precision_livreur text default null,
  p_mode_paiement text default 'livraison',
  p_wave_session_id text default null,
  p_localite_id bigint default null,
  p_lieu_special_id bigint default null,
  p_localite_nom text default null,
  p_frais_livraison_a_confirmer boolean default false
)
returns bigint as $$
declare
  v_commande_id bigint;
  v_ligne jsonb;
  v_quantite integer;
  v_produit_id bigint;
  v_est_kit boolean;
  v_statut text;
  v_statut_paiement text;
begin
  if p_reference is not null then
    select id into v_commande_id from commandes where client_reference = p_reference;
    if found then
      return v_commande_id;
    end if;
  end if;

  if p_mode_paiement = 'wave' then
    v_statut := 'paiement_en_attente';
    v_statut_paiement := 'en_attente';
  else
    v_statut := 'a_confirmer_appel';
    v_statut_paiement := null;
  end if;

  for v_ligne in
    select value from jsonb_array_elements(p_lignes) as t(value)
    order by (value->>'produit_id')::bigint, (value->>'variante_id')::bigint nulls first
  loop
    v_quantite := (v_ligne->>'quantite')::integer;

    if (v_ligne->>'variante_id') is not null then
      update produit_variantes set stock = greatest(stock - v_quantite, 0)
        where id = (v_ligne->>'variante_id')::bigint;
    else
      v_produit_id := (v_ligne->>'produit_id')::bigint;
      select est_kit into v_est_kit from produits where id = v_produit_id;

      if v_est_kit then
        update produits p set stock = greatest(p.stock - (ck.quantite * v_quantite), 0)
          from composition_kit ck
          where ck.kit_id = v_produit_id and p.id = ck.composant_id;
      else
        update produits set stock = greatest(stock - v_quantite, 0)
          where id = v_produit_id;
      end if;
    end if;
  end loop;

  insert into commandes (
    client_id, zone_id, adresse, mode_livraison, frais_livraison,
    sous_total, total, client_reference, lat, lng, precision_livreur,
    mode_paiement, statut, statut_paiement, wave_session_id,
    localite_id, lieu_special_id, localite_nom, frais_livraison_a_confirmer
  )
  values (
    p_client_id, p_zone_id, p_adresse, p_mode_livraison, p_frais_livraison,
    p_sous_total, p_total, p_reference, p_lat, p_lng, p_precision_livreur,
    p_mode_paiement, v_statut, v_statut_paiement, p_wave_session_id,
    p_localite_id, p_lieu_special_id, p_localite_nom, p_frais_livraison_a_confirmer
  )
  returning id into v_commande_id;

  insert into commande_items (
    commande_id, produit_id, variante_id, quantite, prix_unitaire,
    kit_groupe_id, kit_id, kit_nom, kit_classe, kit_gamme, kit_beneficiaire_prenom,
    personnalisation_nom, personnalisation_specialite
  )
  select
    v_commande_id,
    (l->>'produit_id')::bigint,
    (l->>'variante_id')::bigint,
    (l->>'quantite')::integer,
    (l->>'prix_unitaire')::integer,
    l->>'kit_groupe_id',
    (l->>'kit_id')::bigint,
    l->>'kit_nom',
    l->>'kit_classe',
    l->>'kit_gamme',
    l->>'kit_beneficiaire_prenom',
    l->>'personnalisation_nom',
    l->>'personnalisation_specialite'
  from jsonb_array_elements(p_lignes) as l;

  return v_commande_id;
end;
$$ language plpgsql security definer;

create or replace function ajouter_a_commande(
  p_commande_id bigint,
  p_reference text,
  p_mode_paiement text,
  p_sous_total integer,
  p_lignes jsonb,
  p_wave_session_id text default null
)
returns bigint as $$
declare
  v_ajout_id bigint;
  v_statut text;
  v_statut_paiement text;
  v_ligne jsonb;
  v_quantite integer;
  v_produit_id bigint;
  v_est_kit boolean;
begin
  if p_reference is not null then
    select id into v_ajout_id from commande_ajouts where reference = p_reference;
    if found then
      return v_ajout_id;
    end if;
  end if;

  select statut into v_statut from commandes where id = p_commande_id for update;
  if not found or not commande_modifiable_pour_ajout(v_statut) then
    raise exception 'commande_non_modifiable';
  end if;

  if p_mode_paiement = 'wave' then
    v_statut_paiement := 'en_attente';
  else
    v_statut_paiement := null;
  end if;

  insert into commande_ajouts (commande_id, reference, sous_total, mode_paiement, statut_paiement, wave_session_id)
  values (p_commande_id, p_reference, p_sous_total, p_mode_paiement, v_statut_paiement, p_wave_session_id)
  returning id into v_ajout_id;

  for v_ligne in
    select value from jsonb_array_elements(p_lignes) as t(value)
    order by (value->>'produit_id')::bigint, (value->>'variante_id')::bigint nulls first
  loop
    v_quantite := (v_ligne->>'quantite')::integer;

    if (v_ligne->>'variante_id') is not null then
      update produit_variantes set stock = greatest(stock - v_quantite, 0)
        where id = (v_ligne->>'variante_id')::bigint;
    else
      v_produit_id := (v_ligne->>'produit_id')::bigint;
      select est_kit into v_est_kit from produits where id = v_produit_id;

      if v_est_kit then
        update produits p set stock = greatest(p.stock - (ck.quantite * v_quantite), 0)
          from composition_kit ck
          where ck.kit_id = v_produit_id and p.id = ck.composant_id;
      else
        update produits set stock = greatest(stock - v_quantite, 0)
          where id = v_produit_id;
      end if;
    end if;
  end loop;

  insert into commande_items (
    commande_id, produit_id, variante_id, quantite, prix_unitaire, ajout_id,
    kit_groupe_id, kit_id, kit_nom, kit_classe, kit_gamme, kit_beneficiaire_prenom,
    personnalisation_nom, personnalisation_specialite
  )
  select
    p_commande_id,
    (l->>'produit_id')::bigint,
    (l->>'variante_id')::bigint,
    (l->>'quantite')::integer,
    (l->>'prix_unitaire')::integer,
    v_ajout_id,
    l->>'kit_groupe_id',
    (l->>'kit_id')::bigint,
    l->>'kit_nom',
    l->>'kit_classe',
    l->>'kit_gamme',
    l->>'kit_beneficiaire_prenom',
    l->>'personnalisation_nom',
    l->>'personnalisation_specialite'
  from jsonb_array_elements(p_lignes) as l;

  if p_mode_paiement = 'livraison' then
    update commandes
       set sous_total = sous_total + p_sous_total,
           total      = total + p_sous_total
     where id = p_commande_id;
  end if;

  return v_ajout_id;
end;
$$ language plpgsql security definer;

revoke execute on function ajouter_a_commande(bigint, text, text, integer, jsonb, text) from public, anon, authenticated;
grant execute on function ajouter_a_commande(bigint, text, text, integer, jsonb, text) to service_role;

-- ============================================================================
-- Contrôles post-exécution
-- ============================================================================
-- 1. select slug from sous_categories where categorie_id = 4 order by ordre;
--    -> compas, rapporteurs, regles, equerres, kits-tracage.
-- 2. select slug from sous_categories where categorie_id = 11 and slug = 'blouses-laboratoire';
--    -> une ligne.
-- 3. \d produit_classements_secondaires -> table présente, RLS activée.
-- 4. \d produits -> personnalisable (bool, défaut false), prix_personnalisation,
--    achat_personnalisation (integer, nullables) présentes.
-- 5. \d commande_items -> personnalisation_nom, personnalisation_specialite (text) présentes.
-- 6. Passer une commande test avec une ligne personnalisation_nom/specialite
--    renseignés côté app -> la ligne commande_items les porte bien.
