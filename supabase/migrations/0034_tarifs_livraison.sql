-- SacAdo — Grille de livraison par localité (IMPLEMENTATION_TARIFS_LIVRAISON.md)
-- À exécuter APRÈS 0033, dans le SQL Editor Supabase.
-- Idempotent : peut être relancé sans erreur.
--
-- Remplace la déduction "région la plus proche de l'épingle" par un choix
-- explicite de LOCALITÉ (recherche/saisie), qui détermine le tarif via un
-- groupe. La table `zones` existante (nom, tarif_24h, tarif_6j) sert déjà
-- exactement à ça : on la réutilise comme "groupes de livraison" plutôt que
-- de créer une table en double — seul son contenu change (les anciennes
-- lignes par région restent en base pour les commandes historiques qui les
-- référencent encore, mais ne sont plus utilisées par le checkout).
--
-- Nouveau : `localites` (nom -> groupe) et `lieux_speciaux` (tarif/mode/message
-- propres, en dehors du système de groupes : retrait à Thiès, EPT, "autres
-- régions" à confirmer). Le point carte devient optionnel (précision livreur
-- uniquement) : `commandes.zone_id` doit donc pouvoir être NULL (lieu spécial
-- ou localité non reconnue).

-- ============================================================================
-- 1. Groupes de livraison (nouvelles lignes dans `zones`)
-- ============================================================================
insert into zones (nom, tarif_24h, tarif_6j)
select v.nom, v.tarif_24h, v.tarif_6j
from (values
  ('Notre zone', 2500, 1500),
  ('Banlieue proche', 2750, 1750),
  ('Dakar intermédiaire', 3000, 2000),
  ('Centre / résidentiel', 3500, 2500),
  ('Périphérie lointaine', 3500, 2500)
) as v(nom, tarif_24h, tarif_6j)
where not exists (select 1 from zones z where z.nom = v.nom);

-- ============================================================================
-- 2. Localités (rattachées à un groupe)
-- ============================================================================
create table if not exists localites (
  id         bigint generated always as identity primary key,
  nom        text not null unique,
  groupe_id  bigint not null references zones (id),
  lat        double precision,
  lng        double precision,
  created_at timestamptz not null default now()
);

alter table localites enable row level security;

-- Lecture publique : le checkout doit pouvoir peupler le sélecteur de
-- localité sans passer par service_role. Écriture réservée à l'admin.
drop policy if exists "Lecture publique localites" on localites;
create policy "Lecture publique localites" on localites
  for select using (true);

insert into localites (nom, groupe_id)
select v.nom, z.id
from (values
  ('Diamaguène', 'Notre zone'), ('Sicap Mbao', 'Notre zone'), ('Grand Mbao', 'Notre zone'),
  ('Petit Mbao', 'Notre zone'), ('Zac Mbao', 'Notre zone'), ('Thiaroye', 'Notre zone'),
  ('Yeumbeul', 'Notre zone'), ('Keur Mbaye Fall', 'Notre zone'), ('Malika', 'Notre zone'),

  ('Guédiawaye', 'Banlieue proche'), ('Pikine', 'Banlieue proche'), ('Dalifort', 'Banlieue proche'),
  ('Grand Yoff', 'Banlieue proche'), ('Khar Yallah', 'Banlieue proche'),

  ('Grand Dakar', 'Dakar intermédiaire'), ('Liberté', 'Dakar intermédiaire'),
  ('Sicap Liberté', 'Dakar intermédiaire'), ('HLM', 'Dakar intermédiaire'),
  ('Dieuppeul Derklé', 'Dakar intermédiaire'), ('Niarry Tally', 'Dakar intermédiaire'),
  ('Biscuiterie', 'Dakar intermédiaire'), ('Castor', 'Dakar intermédiaire'),
  ('Gibraltar', 'Dakar intermédiaire'), ('Hanne Bel Air', 'Dakar intermédiaire'),
  ('Yarakh', 'Dakar intermédiaire'),

  ('Plateau', 'Centre / résidentiel'), ('Médina', 'Centre / résidentiel'),
  ('Fann', 'Centre / résidentiel'), ('Point E', 'Centre / résidentiel'),
  ('Sacré Cœur', 'Centre / résidentiel'), ('Mermoz', 'Centre / résidentiel'),
  ('Almadies', 'Centre / résidentiel'), ('Ngor', 'Centre / résidentiel'),
  ('Ouakam', 'Centre / résidentiel'), ('Yoff', 'Centre / résidentiel'),
  ('Parcelles Assainies', 'Centre / résidentiel'), ('Mamelles', 'Centre / résidentiel'),
  ('Amitié', 'Centre / résidentiel'), ('Golf', 'Centre / résidentiel'),
  ('Nord Foire', 'Centre / résidentiel'), ('Ouest Foire', 'Centre / résidentiel'),
  ('Sud Foire', 'Centre / résidentiel'), ('Patte d''Oie', 'Centre / résidentiel'),
  ('Cité Keur Gorgui', 'Centre / résidentiel'), ('Camberène', 'Centre / résidentiel'),

  ('Keur Massar', 'Périphérie lointaine'), ('Rufisque', 'Périphérie lointaine'),
  ('Sangalkam', 'Périphérie lointaine'), ('Sébikotane', 'Périphérie lointaine'),
  ('Diamniadio', 'Périphérie lointaine'), ('Bargny', 'Périphérie lointaine'),
  ('Diass', 'Périphérie lointaine')
) as v(nom, groupe_nom)
join zones z on z.nom = v.groupe_nom
where not exists (select 1 from localites l where l.nom = v.nom);

-- ============================================================================
-- 3. Lieux spéciaux (tarif/mode propres, hors système de groupes)
-- ============================================================================
create table if not exists lieux_speciaux (
  id         bigint generated always as identity primary key,
  nom        text not null unique,
  -- NULL uniquement quand mode = 'a_confirmer' (pas de montant fixe encore).
  tarif      integer check (tarif is null or tarif >= 0),
  mode       text not null check (mode in ('livraison', 'retrait', 'a_confirmer')),
  message    text,
  created_at timestamptz not null default now()
);

alter table lieux_speciaux enable row level security;

drop policy if exists "Lecture publique lieux_speciaux" on lieux_speciaux;
create policy "Lecture publique lieux_speciaux" on lieux_speciaux
  for select using (true);

insert into lieux_speciaux (nom, tarif, mode, message)
select v.nom, v.tarif, v.mode, v.message
from (values
  ('Thiès (gare Dem Dikk)', 2500, 'retrait',
    'Retrait à la gare Dem Dikk de Thiès. Ce n''est pas une livraison à domicile : ton colis voyage par bus.'),
  ('École Polytechnique de Thiès (EPT)', 1000, 'livraison',
    'On amène tes fournitures directement à l''École Polytechnique de Thiès le jour de livraison.'),
  ('Mbour', null, 'a_confirmer',
    'Hors de notre zone habituelle : le tarif de livraison sera confirmé avec toi après ta commande.'),
  ('Touba', null, 'a_confirmer',
    'Hors de notre zone habituelle : le tarif de livraison sera confirmé avec toi après ta commande.'),
  ('Saint-Louis', null, 'a_confirmer',
    'Hors de notre zone habituelle : le tarif de livraison sera confirmé avec toi après ta commande.'),
  ('Louga', null, 'a_confirmer',
    'Hors de notre zone habituelle : le tarif de livraison sera confirmé avec toi après ta commande.'),
  ('Ziguinchor', null, 'a_confirmer',
    'Hors de notre zone habituelle : le tarif de livraison sera confirmé avec toi après ta commande.'),
  ('Tivaouane', null, 'a_confirmer',
    'Hors de notre zone habituelle : le tarif de livraison sera confirmé avec toi après ta commande.'),
  ('Saly', null, 'a_confirmer',
    'Hors de notre zone habituelle : le tarif de livraison sera confirmé avec toi après ta commande.')
) as v(nom, tarif, mode, message)
where not exists (select 1 from lieux_speciaux ls where ls.nom = v.nom);

-- ============================================================================
-- 4. Seuil de livraison gratuite, réglable en admin (table `parametres`, 0017)
-- ============================================================================
insert into parametres (cle, valeur, description)
select
  'seuil_livraison_gratuite',
  '75000',
  'Sous-total (FCFA) à partir duquel la livraison est offerte, quelle que soit la localité.'
where not exists (select 1 from parametres where cle = 'seuil_livraison_gratuite');

-- ============================================================================
-- 5. commandes : zone_id devient facultatif (lieu spécial / localité inconnue
--    n'appartiennent à aucun groupe) + colonnes de traçabilité de la livraison
-- ============================================================================
alter table commandes alter column zone_id drop not null;

alter table commandes add column if not exists localite_id bigint references localites (id) on delete set null;
alter table commandes add column if not exists lieu_special_id bigint references lieux_speciaux (id) on delete set null;
-- Libellé toujours renseigné (localité reconnue, lieu spécial, ou saisie libre
-- si rien ne correspond) : reste lisible même si la ligne référencée est
-- supprimée plus tard.
alter table commandes add column if not exists localite_nom text;
alter table commandes add column if not exists frais_livraison_a_confirmer boolean not null default false;

-- ============================================================================
-- 6. creer_commande() : nouveaux paramètres de livraison
-- ============================================================================
-- Signature d'avant ce lot (14 arguments, migration 0024) : à retirer pour
-- éviter une surcharge ambiguë avec la nouvelle (18 arguments).
drop function if exists creer_commande(
  bigint, bigint, text, text, integer, integer, integer, text, jsonb,
  double precision, double precision, text, text, text
);

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
  v_stock integer;
  v_quantite integer;
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
    v_statut := 'recue';
    v_statut_paiement := null;
  end if;

  for v_ligne in
    select value from jsonb_array_elements(p_lignes) as t(value)
    order by (value->>'produit_id')::bigint, (value->>'variante_id')::bigint nulls first
  loop
    v_quantite := (v_ligne->>'quantite')::integer;

    if (v_ligne->>'variante_id') is not null then
      select stock into v_stock from produit_variantes
        where id = (v_ligne->>'variante_id')::bigint for update;
      if v_stock is null or v_stock < v_quantite then
        raise exception 'STOCK_INSUFFISANT:%', (v_ligne->>'produit_id');
      end if;
      update produit_variantes set stock = stock - v_quantite
        where id = (v_ligne->>'variante_id')::bigint;
    else
      select stock into v_stock from produits
        where id = (v_ligne->>'produit_id')::bigint for update;
      if v_stock is null or v_stock < v_quantite then
        raise exception 'STOCK_INSUFFISANT:%', (v_ligne->>'produit_id');
      end if;
      update produits set stock = stock - v_quantite
        where id = (v_ligne->>'produit_id')::bigint;
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

  insert into commande_items (commande_id, produit_id, variante_id, quantite, prix_unitaire)
  select
    v_commande_id,
    (l->>'produit_id')::bigint,
    (l->>'variante_id')::bigint,
    (l->>'quantite')::integer,
    (l->>'prix_unitaire')::integer
  from jsonb_array_elements(p_lignes) as l;

  return v_commande_id;
end;
$$ language plpgsql security definer;

revoke execute on function creer_commande(
  bigint, bigint, text, text, integer, integer, integer, text, jsonb,
  double precision, double precision, text, text, text,
  bigint, bigint, text, boolean
) from public, anon, authenticated;
grant execute on function creer_commande(
  bigint, bigint, text, text, integer, integer, integer, text, jsonb,
  double precision, double precision, text, text, text,
  bigint, bigint, text, boolean
) to service_role;
