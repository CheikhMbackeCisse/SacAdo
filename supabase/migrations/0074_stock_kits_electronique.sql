-- SacAdo — décrément du stock des composants d'un kit à la commande
-- (TACHE_kits_impression_classement.md Chantier A.3). À exécuter APRÈS 0073,
-- dans le SQL Editor Supabase. Idempotent (create or replace).
--
-- Règle : commander un kit décrémente le stock de CHAQUE composant
-- (composition_kit), multiplié par sa quantité dans le kit puis par la
-- quantité commandée, plafonné à zéro comme le reste. Le stock du kit
-- lui-même n'est jamais touché — la disponibilité d'un kit vient uniquement
-- de son `statut`, posé à la main (règle générale depuis 0071).
--
-- Attention (rappel du fichier de tâche) : seule la signature à 18
-- paramètres de creer_commande() est appelée par l'application (depuis la
-- migration 0034). Le corps ci-dessous est identique à celui de 0071, sauf
-- la branche kit ajoutée dans la boucle de décrément — rien d'autre ne change.
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

-- ============================================================================
-- Contrôles post-exécution (à lancer après la migration)
-- ============================================================================
-- Passer une commande de test contenant un kit (via l'app), puis :
-- select p.nom, p.stock from produits p
--   join composition_kit ck on ck.composant_id = p.id
--   where ck.kit_id = <id_du_kit>;
-- -- le stock de chaque composant doit avoir baissé de sa quantité dans le
-- -- kit ; select stock from produits where id = <id_du_kit> ne doit pas bouger.
