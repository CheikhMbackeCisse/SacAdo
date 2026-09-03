-- SacAdo — Webhook de paiement Wave (INTEGRATION_WAVE.md, W4)
-- À exécuter APRÈS 0024, dans le SQL Editor Supabase.
-- Idempotent : peut être relancé sans erreur.
--
-- Le webhook signé de Wave est la SEULE preuve de paiement (jamais le retour du
-- client sur la success_url). Toute la transition d'état se fait ici, dans une
-- seule fonction atomique et idempotente :
--   * table wave_evenements  : journal des event_id déjà traités (Wave renvoie
--     le même webhook plusieurs fois — on ne le traite qu'une fois).
--   * traiter_paiement_wave() : retrouve la commande, vérifie le montant,
--     passe 'payee' (+ statut 'recue' => flux normal) ou 'echoue' (+ relâche le
--     stock réservé à la création).

-- 1. Journal des évènements webhook (idempotence).
create table if not exists wave_evenements (
  event_id    text primary key,
  commande_id bigint references commandes (id) on delete set null,
  type        text not null,
  recu_le     timestamptz not null default now()
);

alter table wave_evenements enable row level security;
-- Aucune policy publique : accès service_role uniquement (comme commandes).

-- 2. Traitement d'un évènement de paiement Wave.
--    p_resultat : 'paye' (paiement confirmé) | 'echoue' (échec / annulation).
--    p_montant  : montant encaissé en FCFA (obligatoire si 'paye').
--    Retour : code texte décrivant ce qui a été fait (pour les logs / tests).
create or replace function traiter_paiement_wave(
  p_event_id text,
  p_reference text,
  p_session_id text,
  p_resultat text,
  p_montant integer
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
           montant_paye     = p_montant
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

    -- Déjà échouée : ne pas relâcher le stock une seconde fois.
    if v_commande.statut_paiement in ('echoue', 'annulee') then
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
       set statut_paiement = 'echoue',
           wave_event_id   = p_event_id
     where id = v_commande.id;

    insert into wave_evenements (event_id, commande_id, type)
      values (p_event_id, v_commande.id, 'echoue');
    return 'ok_echouee';
  end if;

  return 'resultat_inconnu';
end;
$$ language plpgsql security definer;

revoke execute on function traiter_paiement_wave(text, text, text, text, integer)
  from public, anon, authenticated;
grant execute on function traiter_paiement_wave(text, text, text, text, integer)
  to service_role;
