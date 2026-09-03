-- SacAdo — Paiement Wave : colonnes & statuts (INTEGRATION_WAVE.md, lot W1)
-- À exécuter APRÈS 0022, dans le SQL Editor Supabase.
-- Idempotent : peut être relancé sans erreur.
--
-- Ce lot ne fait QUE préparer le terrain (schéma + config). Aucun appel à
-- l'API Wave, aucun webhook, aucune règle de seuil ici : voir les lots
-- W2 (seuil serveur) / W3 (session de paiement + redirection) / W4 (webhook
-- signé + idempotence). creer_commande() n'est PAS touchée ici : le flux de
-- checkout actuel (paiement à la livraison) continue de fonctionner à
-- l'identique — une commande 'livraison' a statut_paiement = NULL.
--
-- Modèle retenu :
--   * commandes.mode_paiement : 'livraison' (défaut, paiement au livreur à la
--     remise) ou 'wave' (paiement en ligne payé d'avance).
--   * commandes.statut_paiement : cycle de vie du paiement Wave
--     (en_attente / payee / echoue / annulee). NULL pour une commande payée à
--     la livraison — on ne suit pas d'état de paiement dans ce cas.
--   * commandes.statut gagne une valeur initiale 'paiement_en_attente' : une
--     commande Wave existe en base dès le clic « payer », mais reste HORS du
--     flux de préparation tant que le webhook n'a pas confirmé le paiement.
--     À la confirmation elle bascule sur 'recue' et entre dans le flux normal.
--   * wave_session_id : id de session de paiement renvoyé par Wave (traçabilité).
--   * wave_event_id : id du dernier événement webhook traité (idempotence via
--     index unique — un même événement Wave n'est jamais traité deux fois).
--   * montant_paye : montant réellement encaissé, en FCFA (entier), revérifié
--     côté serveur contre le total de la commande.

-- 1. mode_paiement : autoriser 'wave' en plus de 'livraison'.
alter table commandes drop constraint if exists commandes_mode_paiement_check;
alter table commandes
  add constraint commandes_mode_paiement_check
  check (mode_paiement in ('livraison', 'wave'));

-- 2. statut : nouvelle valeur initiale 'paiement_en_attente' (avant 'recue').
alter table commandes drop constraint if exists commandes_statut_check;
alter table commandes
  add constraint commandes_statut_check
  check (statut in ('paiement_en_attente', 'recue', 'preparation', 'livraison', 'livree'));

-- 3. Colonnes de paiement Wave (nullable : NULL = commande payée à la livraison).
alter table commandes add column if not exists statut_paiement text;
alter table commandes add column if not exists wave_session_id text;
alter table commandes add column if not exists wave_event_id text;
alter table commandes add column if not exists montant_paye integer;

alter table commandes drop constraint if exists commandes_statut_paiement_check;
alter table commandes
  add constraint commandes_statut_paiement_check
  check (statut_paiement is null
         or statut_paiement in ('en_attente', 'payee', 'echoue', 'annulee'));

alter table commandes drop constraint if exists commandes_montant_paye_check;
alter table commandes
  add constraint commandes_montant_paye_check
  check (montant_paye is null or montant_paye >= 0);

-- Cohérence : une commande 'wave' a toujours un statut_paiement ; une commande
-- 'livraison' n'en a jamais. (Les commandes existantes sont toutes 'livraison'
-- avec statut_paiement NULL → la contrainte passe sans reprise de données.)
alter table commandes drop constraint if exists commandes_paiement_coherence_check;
alter table commandes
  add constraint commandes_paiement_coherence_check
  check (
    (mode_paiement = 'wave' and statut_paiement is not null)
    or (mode_paiement = 'livraison' and statut_paiement is null)
  );

-- 4. Idempotence webhook : un événement Wave n'est traité qu'une seule fois.
create unique index if not exists idx_commandes_wave_event_id
  on commandes (wave_event_id)
  where wave_event_id is not null;

-- Filtre admin « commandes en attente de paiement » (peu de lignes, mais requête
-- fréquente sur le back-office).
create index if not exists idx_commandes_statut_paiement
  on commandes (statut_paiement)
  where statut_paiement is not null;

-- 5. Boîte de réception : aucun message tant que la commande est en attente de
--    paiement — elle n'est pas « reçue » avant confirmation du webhook Wave.
--    Quand elle bascule 'paiement_en_attente' -> 'recue', le message
--    « Commande reçue » part normalement (comportement inchangé pour les
--    commandes payées à la livraison, créées directement en 'recue').
create or replace function notify_commande_statut() returns trigger as $$
declare
  libelle text;
begin
  if tg_op = 'UPDATE' and new.statut = old.statut then
    return new;
  end if;

  if new.statut = 'paiement_en_attente' then
    return new;
  end if;

  libelle := case new.statut
    when 'recue' then 'Commande reçue'
    when 'preparation' then 'Commande en préparation'
    when 'livraison' then 'Commande en cours de livraison'
    when 'livree' then 'Commande livrée'
    else new.statut
  end;

  insert into messages (client_id, type, titre, corps)
  values (
    new.client_id,
    'commande',
    libelle,
    'Votre commande #' || new.id || ' est maintenant : ' || libelle || '.'
  );

  return new;
end;
$$ language plpgsql;
