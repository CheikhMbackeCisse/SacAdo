-- SacAdo — PROMPT_CLIENT_V2 Lot 1 : Wave par défaut, paiement à la livraison
-- au choix (sauf plafond admin). À exécuter APRÈS 0104, dans le SQL Editor
-- Supabase. Idempotente.
--
-- 1. Deux nouveaux statuts de commande :
--    * 'a_confirmer_appel' : commande payée à la livraison, créée dans cet
--      état (plus 'recue' directement) — on appelle le client pour confirmer
--      avant l'envoi. L'admin la fait passer 'recue' après l'appel.
--    * 'annulee' : état final, commande qui ne sera pas honorée.
-- 2. creer_commande() : une commande 'livraison' part maintenant sur
--    'a_confirmer_appel' au lieu de 'recue' (le mode Wave est inchangé :
--    toujours 'paiement_en_attente', confirmé ensuite par le webhook).
-- 3. Trigger notify_commande_statut() : messages de boîte de réception pour
--    les deux nouveaux statuts, + distinction "paiement reçu" (Wave) du
--    "commande confirmée" générique (appel / livraison) sur la transition
--    vers 'recue'.
-- 4. Modèles de messages par défaut pour 'commande_a_confirmer' et
--    'commande_annulee' (éditables ensuite dans /admin/modeles).
--
-- Le réglage du plafond de paiement à la livraison (paiement_livraison_max,
-- vide = pas de limite) ne nécessite AUCUNE migration : il vit dans la table
-- `parametres` générique (clé/valeur), déjà en place — voir lib/parametres.ts.

-- 1. Statuts.
alter table commandes drop constraint if exists commandes_statut_check;
alter table commandes
  add constraint commandes_statut_check
  check (statut in (
    'paiement_en_attente', 'a_confirmer_appel', 'recue', 'preparation',
    'livraison', 'livree', 'probleme', 'annulee'
  ));

-- 2. creer_commande() : identique à 0100, sauf le statut initial d'une
-- commande payée à la livraison.
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
    -- Paiement à la livraison : on appelle le client pour confirmer avant
    -- l'envoi (PROMPT_CLIENT_V2 Lot 1) — plus de passage direct à 'recue'.
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

-- 3. Trigger : nouveaux codes + distinction paiement Wave / confirmation
-- générique sur l'entrée en 'recue'.
create or replace function notify_commande_statut() returns trigger as $$
declare
  v_code    text;
  v_titre   text;
  v_contenu text;
  v_montant text;
begin
  if tg_op = 'UPDATE' and new.statut = old.statut then
    return new;
  end if;

  v_code := case
    -- Wave confirmé par le webhook : message dédié "paiement reçu", distinct
    -- de la confirmation générique (appel / autre). Référence à OLD protégée
    -- par le and (court-circuit) : jamais évaluée sur un INSERT.
    when new.statut = 'recue' and tg_op = 'UPDATE' and old.statut = 'paiement_en_attente'
      then 'paiement_recu'
    when new.statut = 'recue'            then 'commande_confirmee'
    when new.statut = 'a_confirmer_appel' then 'commande_a_confirmer'
    when new.statut = 'preparation'       then 'commande_preparation'
    when new.statut = 'livraison'         then 'commande_route'
    when new.statut = 'livree'            then 'commande_livree'
    when new.statut = 'probleme'          then 'commande_probleme'
    when new.statut = 'annulee'           then 'commande_annulee'
    else null
  end;

  -- 'paiement_en_attente' et tout statut non mappé : aucun message.
  if v_code is null then
    return new;
  end if;

  select titre, contenu into v_titre, v_contenu
    from modeles_messages
   where code = v_code and canal = 'inbox' and actif;

  v_montant := replace(to_char(new.total, 'FM999,999,999,999'), ',', ' ');

  if v_contenu is null then
    v_titre   := 'Mise à jour de ta commande';
    v_contenu := 'Ta commande n°' || new.id || ' a changé de statut.';
  else
    v_contenu := replace(v_contenu, '{numero_commande}', new.id::text);
    v_contenu := replace(v_contenu, '{montant}', v_montant);
    v_contenu := replace(v_contenu, '{localite}', coalesce(new.localite_nom, 'ta localité'));
    v_contenu := replace(v_contenu, '{prenom}', '');
    v_contenu := replace(v_contenu, '{lien_produit}', '');
    v_contenu := replace(v_contenu, '{lien_commande}', '');
    v_contenu := replace(v_contenu, '{lien}', '');
    v_contenu := replace(v_contenu, '{articles}', 'un article');
  end if;

  insert into messages (client_id, type, titre, corps, lien)
  values (
    new.client_id,
    'commande',
    coalesce(v_titre, 'Mise à jour de ta commande'),
    v_contenu,
    '/suivi/' || new.id
  );

  return new;
end;
$$ language plpgsql;

-- 4. Modèles par défaut (on conflict do nothing : n'écrase jamais un modèle
-- déjà édité dans l'admin).
insert into modeles_messages (code, canal, libelle, titre, contenu, ordre) values

('commande_a_confirmer', 'whatsapp', 'Appel de confirmation', null,
 E'Salut {prenom}, c''est SacAdo. On a bien reçu ta commande n°{numero_commande} de {montant} FCFA, payée à la livraison. On t''appelle très vite sur ce numéro pour confirmer avant l''envoi.', 2),
('commande_a_confirmer', 'inbox', 'On va t''appeler', 'On va t''appeler',
 'Ta commande n°{numero_commande} de {montant} FCFA est enregistrée. On t''appelle sur WhatsApp pour la confirmer avant l''envoi.', 2),

('commande_annulee', 'whatsapp', 'Commande annulée', null,
 '{prenom}, ta commande n°{numero_commande} a été annulée. Si c''est une erreur ou que tu veux repasser commande, réponds à ce message.', 6),
('commande_annulee', 'inbox', 'Commande annulée', 'Commande annulée',
 'Ta commande n°{numero_commande} a été annulée.', 6)

on conflict (code, canal) do nothing;

-- ============================================================================
-- Contrôles post-exécution
-- ============================================================================
-- 1. select conname, pg_get_constraintdef(oid) from pg_constraint
--    where conname = 'commandes_statut_check';
--    -> doit lister les 8 statuts, dont 'a_confirmer_appel' et 'annulee'.
-- 2. Passer une commande à la livraison (app) -> statut initial doit être
--    'a_confirmer_appel', avec un message "On va t'appeler" dans `messages`.
-- 3. Passer une commande Wave (simulation ou réelle) -> au webhook, statut
--    'recue' avec un message tiré du modèle 'paiement_recu' (pas
--    'commande_confirmee').
-- 4. Dans l'admin, passer une commande à 'annulee' -> message "Commande
--    annulée" dans la boîte de réception du client.
