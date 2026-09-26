-- SacAdo — Diagnostic des échecs de paiement Wave (INTEGRATION_WAVE.md)
-- À exécuter APRÈS 0086, dans le SQL Editor Supabase. Idempotente.
--
-- Wave renvoie sur `checkout.session.payment_failed` un code d'erreur brut
-- (data.last_payment_error.code : insufficient-funds, blocked-account,
-- payer-mobile-mismatch, etc. — docs.wave.com/webhook). On le stocke TEL QUEL
-- pour le diagnostic ; le message affiché au client est traduit en français
-- ailleurs, dans le code (lib/wave/webhook-core.ts::messageErreurPaiement),
-- jamais en base — reformuler un message ne doit jamais nécessiter une
-- migration. L'horodatage de l'échec accompagne le code : sans lui, un code
-- vieux de plusieurs semaines ne dit rien sur quand le problème a eu lieu.
--
-- wave_erreur_code / wave_erreur_le sont effacés quand la commande finit par
-- être payée (traiter_paiement_wave, branche 'paye') : une commande payée ne
-- doit pas garder la trace d'un échec antérieur à une reprise réussie.

alter table commandes add column if not exists wave_erreur_code text;
alter table commandes add column if not exists wave_erreur_le timestamptz;

-- Signature précédente (5 arguments, migration 0025) à retirer avant de
-- recréer avec le 6e paramètre (CREATE OR REPLACE n'autorise pas d'ajouter un
-- paramètre, même avec défaut, sans casser l'ancienne signature déclarée).
drop function if exists traiter_paiement_wave(text, text, text, text, integer);

create or replace function traiter_paiement_wave(
  p_event_id text,
  p_reference text,
  p_session_id text,
  p_resultat text,
  p_montant integer,
  -- Code d'erreur brut Wave (data.last_payment_error.code). Null si succès ou
  -- si Wave n'a pas fourni de code sur cet échec.
  p_erreur_code text default null
) returns text as $$
declare
  v_commande commandes%rowtype;
  v_item record;
begin
  -- Idempotence : évènement déjà journalisé => ne rien refaire.
  if exists (select 1 from wave_evenements where event_id = p_event_id) then
    return 'deja_traite';
  end if;

  -- Retrouver la commande par la référence de checkout, sinon par la session.
  select * into v_commande from commandes
   where client_reference = p_reference
      or (p_session_id is not null and wave_session_id = p_session_id)
   order by id desc
   limit 1;

  if not found then
    return 'commande_introuvable';
  end if;

  if v_commande.mode_paiement <> 'wave' then
    return 'pas_une_commande_wave';
  end if;

  -- ---- Paiement confirmé -------------------------------------------------
  if p_resultat = 'paye' then
    if v_commande.statut_paiement = 'payee' then
      insert into wave_evenements (event_id, commande_id, type)
        values (p_event_id, v_commande.id, 'paye_repete');
      return 'deja_payee';
    end if;

    -- Le montant encaissé DOIT correspondre au total calculé côté serveur.
    if p_montant is null or p_montant <> v_commande.total then
      insert into wave_evenements (event_id, commande_id, type)
        values (p_event_id, v_commande.id, 'montant_invalide');
      return 'montant_invalide';
    end if;

    update commandes
       set statut          = 'recue',
           statut_paiement  = 'payee',
           wave_event_id    = p_event_id,
           montant_paye     = p_montant,
           -- Une reprise réussie efface la trace de l'échec précédent.
           wave_erreur_code = null,
           wave_erreur_le   = null
     where id = v_commande.id;

    insert into wave_evenements (event_id, commande_id, type)
      values (p_event_id, v_commande.id, 'paye');
    return 'ok_payee';
  end if;

  -- ---- Échec / annulation ---------------------------------------------
  if p_resultat = 'echoue' then
    -- Un échec tardif ne doit jamais défaire un paiement confirmé.
    if v_commande.statut_paiement = 'payee' then
      insert into wave_evenements (event_id, commande_id, type)
        values (p_event_id, v_commande.id, 'echoue_ignore');
      return 'ignore_deja_payee';
    end if;

    -- Déjà échouée : ne pas relâcher le stock une seconde fois, mais on
    -- rafraîchit quand même le code/horodatage au cas où ce nouvel évènement
    -- porte un diagnostic différent (utile si le client retente et échoue
    -- pour une autre raison avant qu'on ait vu passer le premier échec).
    if v_commande.statut_paiement in ('echoue', 'annulee') then
      update commandes
         set wave_erreur_code = p_erreur_code,
             wave_erreur_le   = now()
       where id = v_commande.id;
      insert into wave_evenements (event_id, commande_id, type)
        values (p_event_id, v_commande.id, 'echoue_repete');
      return 'deja_echouee';
    end if;

    -- Relâcher le stock réservé à la création de la commande (0024).
    for v_item in
      select produit_id, variante_id, quantite
        from commande_items where commande_id = v_commande.id
    loop
      if v_item.variante_id is not null then
        update produit_variantes set stock = stock + v_item.quantite
          where id = v_item.variante_id;
      else
        update produits set stock = stock + v_item.quantite
          where id = v_item.produit_id;
      end if;
    end loop;

    update commandes
       set statut_paiement  = 'echoue',
           wave_event_id    = p_event_id,
           wave_erreur_code = p_erreur_code,
           wave_erreur_le   = now()
     where id = v_commande.id;

    insert into wave_evenements (event_id, commande_id, type)
      values (p_event_id, v_commande.id, 'echoue');
    return 'ok_echouee';
  end if;

  return 'resultat_inconnu';
end;
$$ language plpgsql security definer;

revoke execute on function traiter_paiement_wave(text, text, text, text, integer, text)
  from public, anon, authenticated;
grant execute on function traiter_paiement_wave(text, text, text, text, integer, text)
  to service_role;
