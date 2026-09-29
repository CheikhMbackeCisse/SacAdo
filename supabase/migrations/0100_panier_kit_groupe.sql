-- SacAdo — regroupement d'un kit scolaire en une seule "carte" côté panier
-- (CORRECTIONS_V15 Lot 2). À exécuter dans le SQL Editor Supabase. Idempotent
-- (add column if not exists / create or replace).
--
-- Chaque ligne de commande venant d'un kit porte désormais son groupe : un
-- identifiant d'instance (deux enfants dans la même classe = deux groupes
-- différents), l'id du kit, son nom complet, sa classe, sa gamme, et le
-- prénom du bénéficiaire choisi au sélecteur. Dénormalisé sur la ligne (pas
-- de nouvelle table) pour que l'admin et le message WhatsApp regroupent sans
-- jointure. NULL sur les lignes ajoutées hors kit (comme avant).

alter table commande_items add column if not exists kit_groupe_id text;
alter table commande_items add column if not exists kit_id bigint;
alter table commande_items add column if not exists kit_nom text;
alter table commande_items add column if not exists kit_classe text;
alter table commande_items add column if not exists kit_gamme text;
alter table commande_items add column if not exists kit_beneficiaire_prenom text;

create index if not exists commande_items_kit_groupe_id_idx
  on commande_items (kit_groupe_id)
  where kit_groupe_id is not null;

-- Identique au corps de 0074_stock_kits_electronique.sql, sauf l'insert final
-- dans commande_items qui reprend maintenant les 6 champs de groupe kit
-- ci-dessus (absents du JSON envoyé par l'app -> NULL, comme avant cette
-- migration). Rappel : seule la signature à 18 paramètres est appelée par
-- l'application — inchangée ici, tout passe par le contenu de p_lignes.
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
    v_statut := 'recue';
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
        -- Kit : décrémenter chaque composant, jamais le kit lui-même.
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
    kit_groupe_id, kit_id, kit_nom, kit_classe, kit_gamme, kit_beneficiaire_prenom
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
    l->>'kit_beneficiaire_prenom'
  from jsonb_array_elements(p_lignes) as l;

  return v_commande_id;
end;
$$ language plpgsql security definer;

-- ============================================================================
-- Contrôles post-exécution (à lancer après la migration)
-- ============================================================================
-- 1. select column_name from information_schema.columns
--    where table_name = 'commande_items' and column_name like 'kit_%';
--    -> doit lister les 6 nouvelles colonnes.
-- 2. Passer une commande de test avec un kit scolaire (via l'app), puis :
--    select kit_groupe_id, kit_nom, kit_classe, kit_gamme, kit_beneficiaire_prenom
--    from commande_items where commande_id = <id> and kit_groupe_id is not null;
--    -> une ligne par produit du kit, toutes avec le même kit_groupe_id.
-- 3. Vérifier qu'une commande sans kit (produit ajouté seul) a bien
--    kit_groupe_id = null sur sa ligne.
