-- SacAdo — Localisation de livraison (LOCALISATION_LIVRAISON.md)
-- À exécuter APRÈS 0020, dans le SQL Editor Supabase.
-- Idempotent : peut être relancé sans erreur.
--
-- La carte interactive sert à LOCALISER le client (aider le livreur), pas à
-- calculer le prix : la tarification reste par zone (zone_id, inchangée).
-- On stocke le point validé (lat/lng) + une précision texte optionnelle sur la
-- commande, et on retient la dernière position du client (par téléphone) pour
-- pré-remplir la prochaine commande.

-- 1. Colonnes commande : point validé + précision livreur.
alter table commandes add column if not exists lat double precision;
alter table commandes add column if not exists lng double precision;
alter table commandes add column if not exists precision_livreur text;

-- 2. Colonnes client : dernière position mémorisée (carnet d'adresses léger).
alter table clients add column if not exists derniere_lat double precision;
alter table clients add column if not exists derniere_lng double precision;
alter table clients add column if not exists derniere_precision_livreur text;

-- 3. creer_commande : 3 nouveaux paramètres (avec défaut null → l'ancien code
--    continue de fonctionner pendant la fenêtre de déploiement).
drop function if exists creer_commande(
  bigint, bigint, text, text, integer, integer, integer, text, jsonb
);

create function creer_commande(
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
  p_precision_livreur text default null
)
returns bigint as $$
declare
  v_commande_id bigint;
  v_ligne jsonb;
  v_stock integer;
  v_quantite integer;
begin
  if p_reference is not null then
    select id into v_commande_id from commandes where client_reference = p_reference;
    if found then
      return v_commande_id;
    end if;
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
    sous_total, total, client_reference, lat, lng, precision_livreur
  )
  values (
    p_client_id, p_zone_id, p_adresse, p_mode_livraison, p_frais_livraison,
    p_sous_total, p_total, p_reference, p_lat, p_lng, p_precision_livreur
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
  double precision, double precision, text
) from public, anon, authenticated;
grant execute on function creer_commande(
  bigint, bigint, text, text, integer, integer, integer, text, jsonb,
  double precision, double precision, text
) to service_role;
