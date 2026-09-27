-- SacAdo — Module factures, lot 1 : fondations (MODULE_FACTURES.md §1, §4).
-- À exécuter APRÈS 0090, dans le SQL Editor Supabase. Idempotente.
--
-- Une facture = une commande qui atteint le statut 'recue' — que ce soit
-- directement à la création (paiement à la livraison) ou après confirmation
-- du webhook Wave ('paiement_en_attente' -> 'recue', migration 0023). Le
-- passage à 'preparation'/'livraison'/'livree' ne recrée rien : la facture
-- existe déjà.
--
-- Numérotation continue et unique (§1) : on ne stocke PAS de numéro séparé,
-- on utilise l'id de la table `factures` elle-même (identity, jamais réutilisé
-- tant qu'on ne supprime pas de ligne — le système "gère le compteur"
-- automatiquement, sans séquence à entretenir à la main).
--
-- Les informations d'entité (nom légal, NINEA, adresse, contact) ne sont PAS
-- dupliquées ici : elles vivent déjà dans lib/legal.ts (EDITEUR), déjà validées
-- par le fondateur et utilisées pour les mentions légales / Wave. Le PDF de
-- facture (lot 2) les lira depuis ce même fichier.

-- 1. Table des factures.
create table if not exists factures (
  id                bigint generated always as identity primary key,
  commande_id       bigint not null unique references commandes (id),
  code_confirmation text not null unique check (code_confirmation ~ '^[0-9]{6}$'),
  date_emission     timestamptz not null default now()
);

alter table factures enable row level security;
-- Aucune policy publique (données client) : accès service_role uniquement,
-- comme `commandes` — le PDF (lot 2) sera généré par une route serveur qui
-- vérifie le jeton client avant de lire cette table.

-- 2. Génération automatique à l'entrée en statut 'recue'.
--    Idempotente par construction : si une facture existe déjà pour cette
--    commande (ex. re-déclenchement du trigger), on ne fait rien.
create or replace function generer_facture() returns trigger as $$
declare
  v_code text;
begin
  if new.statut <> 'recue' then
    return new;
  end if;

  if exists (select 1 from factures where commande_id = new.id) then
    return new;
  end if;

  loop
    v_code := lpad(floor(random() * 1000000)::text, 6, '0');
    exit when not exists (select 1 from factures where code_confirmation = v_code);
  end loop;

  insert into factures (commande_id, code_confirmation)
  values (new.id, v_code);

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_commandes_facture on commandes;
create trigger trg_commandes_facture
  after insert or update of statut on commandes
  for each row execute function generer_facture();

-- ============================================================================
-- Contrôles post-exécution
-- ============================================================================
-- select * from factures order by id desc limit 5;
-- Test : créer une commande 'livraison' (statut initial 'recue') -> une ligne
-- apparaît aussitôt dans `factures` avec un code à 6 chiffres.
-- Test : faire passer une commande Wave de 'paiement_en_attente' à 'recue'
-- (traiter_paiement_wave) -> une ligne apparaît aussi, une seule fois même si
-- le webhook est rejoué (idempotence de traiter_paiement_wave, 0025).
