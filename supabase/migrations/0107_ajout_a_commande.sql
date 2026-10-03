-- SacAdo — PROMPT_CLIENT_V2 Lot 4 : ajouter des produits à une commande pas
-- encore livrée. À exécuter APRÈS 0106, dans le SQL Editor Supabase.
-- Idempotente.
--
-- But : éviter une deuxième commande (et payer deux fois la livraison) quand
-- le client a oublié un article. Modèle retenu, calqué sur le paiement Wave
-- d'une commande (migrations 0023/0025) :
--   * `commande_ajouts` : une ligne par "lot" d'ajout (un clic sur Terminer),
--     avec son propre cycle de paiement (comme `commandes` pour Wave).
--   * `commande_items.ajout_id` : NULL pour les lignes d'origine, sinon
--     rattache la ligne à son lot d'ajout — "marquées « ajout » avec leur
--     date et leur paiement" (date = commande_ajouts.cree_le, paiement =
--     commande_ajouts.mode_paiement/statut_paiement).
--   * Le total de la commande n'est augmenté qu'une fois l'ajout VALIDÉ :
--     tout de suite pour un ajout payé à la livraison, au webhook Wave pour
--     un ajout payé d'avance. Aucun nouveau frais de livraison (déjà compté).
--   * `wave_evenements` gagne une colonne `ajout_id` : un même event_id Wave
--     reste unique globalement, qu'il concerne une commande ou un ajout.

-- 1. Table des lots d'ajout.
create table if not exists commande_ajouts (
  id              bigint generated always as identity primary key,
  commande_id     bigint not null references commandes (id),
  reference       text not null unique,
  sous_total      integer not null check (sous_total >= 0),
  mode_paiement   text not null check (mode_paiement in ('livraison', 'wave')),
  -- Cycle de vie du paiement Wave de CET ajout (comme commandes.statut_paiement).
  -- NULL pour un ajout payé à la livraison.
  statut_paiement text check (statut_paiement is null or statut_paiement in ('en_attente', 'payee', 'echoue')),
  wave_session_id text,
  wave_event_id   text,
  montant_paye    integer check (montant_paye is null or montant_paye >= 0),
  cree_le         timestamptz not null default now(),
  constraint commande_ajouts_paiement_coherence_check check (
    (mode_paiement = 'wave' and statut_paiement is not null)
    or (mode_paiement = 'livraison' and statut_paiement is null)
  )
);

alter table commande_ajouts enable row level security;
-- Aucune policy publique (données liées à une commande client) : accès
-- service_role uniquement, comme `commandes`.

create index if not exists idx_commande_ajouts_commande_id on commande_ajouts (commande_id);
create unique index if not exists idx_commande_ajouts_wave_event_id
  on commande_ajouts (wave_event_id) where wave_event_id is not null;

-- 2. Rattachement des lignes de commande_items à leur lot d'ajout (NULL =
-- ligne d'origine, créée par creer_commande()).
alter table commande_items add column if not exists ajout_id bigint references commande_ajouts (id);
create index if not exists idx_commande_items_ajout_id on commande_items (ajout_id) where ajout_id is not null;

-- 3. wave_evenements : un même journal sert aux deux flux (idempotence par
-- event_id, déjà unique globalement côté Wave).
alter table wave_evenements add column if not exists ajout_id bigint references commande_ajouts (id);

-- 4. Statuts d'une commande sur laquelle un ajout reste possible (PROMPT_CLIENT_V2
-- Lot 4) : tant qu'elle n'est pas "en_livraison"/"livree"/"annulee". 'probleme'
-- exclue aussi (l'admin doit d'abord régler le souci).
create or replace function commande_modifiable_pour_ajout(p_statut text) returns boolean as $$
  select p_statut in ('a_confirmer_appel', 'recue', 'preparation');
$$ language sql immutable;

-- 5. Création d'un lot d'ajout + ses lignes. Décrémente le stock comme
-- creer_commande() (kit-aware, non bloquant — migration 0071). Si payé à la
-- livraison, le total de la commande est augmenté tout de suite (rien à
-- confirmer) ; si Wave, le total n'augmente qu'au webhook (traiter_paiement_ajout_wave).
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
    kit_groupe_id, kit_id, kit_nom, kit_classe, kit_gamme, kit_beneficiaire_prenom
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
    l->>'kit_beneficiaire_prenom'
  from jsonb_array_elements(p_lignes) as l;

  -- Payé à la livraison : s'ajoute tout de suite au montant dû, rien à
  -- confirmer ensuite (contrairement à Wave, voir traiter_paiement_ajout_wave).
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

-- 6. Traitement du paiement Wave d'un ajout (même logique que
-- traiter_paiement_wave pour une commande, migration 0025 — montant encaissé
-- revérifié, idempotent, relâche le stock si échec).
create or replace function traiter_paiement_ajout_wave(
  p_event_id text,
  p_reference text,
  p_session_id text,
  p_resultat text,
  p_montant integer
) returns text as $$
declare
  v_ajout commande_ajouts%rowtype;
  v_item record;
begin
  if exists (select 1 from wave_evenements where event_id = p_event_id) then
    return 'deja_traite';
  end if;

  select * into v_ajout from commande_ajouts
   where reference = p_reference
      or (p_session_id is not null and wave_session_id = p_session_id)
   order by id desc
   limit 1;

  if not found then
    return 'ajout_introuvable';
  end if;

  if v_ajout.mode_paiement <> 'wave' then
    return 'pas_un_ajout_wave';
  end if;

  if p_resultat = 'paye' then
    if v_ajout.statut_paiement = 'payee' then
      insert into wave_evenements (event_id, ajout_id, type) values (p_event_id, v_ajout.id, 'paye_repete');
      return 'deja_payee';
    end if;

    if p_montant is null or p_montant <> v_ajout.sous_total then
      insert into wave_evenements (event_id, ajout_id, type) values (p_event_id, v_ajout.id, 'montant_invalide');
      return 'montant_invalide';
    end if;

    update commande_ajouts
       set statut_paiement = 'payee', wave_event_id = p_event_id, montant_paye = p_montant
     where id = v_ajout.id;

    update commandes
       set sous_total = sous_total + v_ajout.sous_total,
           total      = total + v_ajout.sous_total
     where id = v_ajout.commande_id;

    insert into wave_evenements (event_id, ajout_id, type) values (p_event_id, v_ajout.id, 'paye');
    return 'ok_payee';
  end if;

  if p_resultat = 'echoue' then
    if v_ajout.statut_paiement = 'payee' then
      insert into wave_evenements (event_id, ajout_id, type) values (p_event_id, v_ajout.id, 'echoue_ignore');
      return 'ignore_deja_payee';
    end if;
    if v_ajout.statut_paiement = 'echoue' then
      insert into wave_evenements (event_id, ajout_id, type) values (p_event_id, v_ajout.id, 'echoue_repete');
      return 'deja_echouee';
    end if;

    for v_item in
      select produit_id, variante_id, quantite from commande_items where ajout_id = v_ajout.id
    loop
      if v_item.variante_id is not null then
        update produit_variantes set stock = stock + v_item.quantite where id = v_item.variante_id;
      else
        update produits set stock = stock + v_item.quantite where id = v_item.produit_id;
      end if;
    end loop;

    update commande_ajouts set statut_paiement = 'echoue', wave_event_id = p_event_id where id = v_ajout.id;

    insert into wave_evenements (event_id, ajout_id, type) values (p_event_id, v_ajout.id, 'echoue');
    return 'ok_echouee';
  end if;

  return 'resultat_inconnu';
end;
$$ language plpgsql security definer;

revoke execute on function traiter_paiement_ajout_wave(text, text, text, text, integer) from public, anon, authenticated;
grant execute on function traiter_paiement_ajout_wave(text, text, text, text, integer) to service_role;

-- 7. Modèle de message par défaut (boîte de réception) à chaque ajout validé.
insert into modeles_messages (code, canal, libelle, titre, contenu, ordre) values
('commande_ajout', 'inbox', 'Produits ajoutés à une commande', 'Ajout à ta commande',
 'Tes articles ajoutés à la commande n°{numero_commande} sont bien enregistrés ({montant} FCFA).', 2)
on conflict (code, canal) do nothing;

-- ============================================================================
-- Contrôles post-exécution
-- ============================================================================
-- 1. select * from commande_ajouts limit 5;
-- 2. select ajout_id, count(*) from commande_items where ajout_id is not null group by ajout_id;
-- 3. Test : appeler ajouter_a_commande(<commande_id>, 'test-ref-1', 'livraison', 500,
--    '[{"produit_id": 1, "variante_id": null, "quantite": 1, "prix_unitaire": 500}]'::jsonb)
--    -> une ligne dans commande_ajouts, une ligne dans commande_items (ajout_id renseigné),
--    commandes.total augmenté de 500.
