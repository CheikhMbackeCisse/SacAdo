-- SacAdo — creer_commande() : support du paiement Wave (INTEGRATION_WAVE.md, W3)
-- À exécuter APRÈS 0023, dans le SQL Editor Supabase.
-- Idempotent : peut être relancé sans erreur.
--
-- Deux nouveaux paramètres, avec défauts => les appels existants (paiement à la
-- livraison) continuent de fonctionner à l'identique.
--   * p_mode_paiement    : 'livraison' (défaut) ou 'wave'.
--   * p_wave_session_id   : id de session de paiement Wave (null tant qu'inconnu).
--
-- Le stock est décrémenté DÈS la création, y compris pour une commande Wave
-- (on réutilise la garantie atomique anti-survente de 0004). Une commande Wave
-- naît en statut 'paiement_en_attente' / statut_paiement 'en_attente' : elle
-- reste hors du flux de préparation. C'est le webhook signé (W4) qui la fera
-- passer 'recue' / 'payee' — ou qui relâchera le stock en cas d'échec/annulation.

-- Signature d'avant ce lot (12 arguments, migration 0021) : à retirer pour
-- éviter une surcharge ambiguë avec la nouvelle (14 arguments).
drop function if exists creer_commande(
  bigint, bigint, text, text, integer, integer, integer, text, jsonb,
  double precision, double precision, text
);

-- create OR REPLACE : la migration reste rejouable une fois la nouvelle
-- signature en place.
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
  p_wave_session_id text default null
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
    mode_paiement, statut, statut_paiement, wave_session_id
  )
  values (
    p_client_id, p_zone_id, p_adresse, p_mode_livraison, p_frais_livraison,
    p_sous_total, p_total, p_reference, p_lat, p_lng, p_precision_livreur,
    p_mode_paiement, v_statut, v_statut_paiement, p_wave_session_id
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
  double precision, double precision, text, text, text
) from public, anon, authenticated;
grant execute on function creer_commande(
  bigint, bigint, text, text, integer, integer, integer, text, jsonb,
  double precision, double precision, text, text, text
) to service_role;
