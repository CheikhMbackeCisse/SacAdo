-- SacAdo — le stock ne bloque plus rien côté client.
-- À exécuter après 0070, dans le SQL Editor Supabase. Idempotent : peut être
-- relancé sans erreur (create or replace / drop if exists partout).
--
-- Contexte : pour la plupart des produits du catalogue (dont Seye Dynamique
-- Technologie), le fondateur ne connaît pas un chiffre de stock fiable — les
-- fournisseurs sourcent à la demande. Un stock bas ou tombé à 0 ne veut donc
-- pas dire "indisponible", juste "je ne sais pas combien il en reste". Deux
-- mécanismes forçaient pourtant une indisponibilité à partir de ce chiffre :
--
--   1. creer_commande() (0004_performance.sql) refusait la commande si le
--      stock en base était inférieur à la quantité demandée
--      (exception STOCK_INSUFFISANT).
--   2. Les triggers trg_produits_statut / trg_produit_variantes_statut
--      (0001_schema.sql) repassaient automatiquement `statut` à "epuise" dès
--      que le stock touchait 0, ce qui affichait "Épuisé" sur le site alors
--      que le produit reste vendable via le fournisseur.
--
-- Les deux sont retirés ici. Le champ `stock` reste en base (toujours
-- décrémenté, plancher à 0) : il continue de nourrir l'alerte de réappro
-- admin (lib/admin/reporting-actions.ts, stock <= seuil_alerte), mais n'a
-- plus aucun effet côté client. "Épuisé" redevient un choix 100% manuel de
-- l'admin via le champ Statut du formulaire produit.
--
-- Correctif (voir chat) : la première version de cette migration patchait la
-- signature à 9 paramètres de creer_commande() (celle de 0004/0021, avant
-- géoloc/Wave/localités). Mais depuis la migration 0034, l'app appelle la
-- version à 18 paramètres (p_lat, p_mode_paiement, p_localite_id, …) —
-- l'ancienne patch ne touchait donc jamais la fonction réellement utilisée,
-- qui continuait de lever STOCK_INSUFFISANT. Ci-dessous : la bonne signature,
-- corps identique à 0034 sauf le contrôle de stock retiré.

-- ============================================================================
-- 1. creer_commande() : ne bloque plus sur le stock (signature à 18 params,
--    celle réellement appelée par lib/checkout/actions.ts depuis 0034)
-- ============================================================================
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
      update produits set stock = greatest(stock - v_quantite, 0)
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

-- Coquille vide laissée par la première version de cette migration (signature
-- à 9 params, jamais appelée par l'app) : à retirer pour éviter toute
-- ambiguïté de surcharge si quelque chose l'appelle un jour sans les params
-- optionnels.
drop function if exists creer_commande(
  bigint, bigint, text, text, integer, integer, integer, text, jsonb
);

-- ============================================================================
-- 2. Plus de bascule automatique à "epuise" quand le stock touche 0
-- ============================================================================
drop trigger if exists trg_produits_statut on produits;
drop trigger if exists trg_produit_variantes_statut on produit_variantes;
drop function if exists set_produit_statut();
drop function if exists set_variante_statut();
