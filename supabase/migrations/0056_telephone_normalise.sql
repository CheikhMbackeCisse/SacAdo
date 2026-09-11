-- SacAdo — Numéros de téléphone normalisés (TACHE_whatsapp_admin.md §3)
-- À exécuter APRÈS 0055, dans le SQL Editor Supabase. Additive + idempotente.
--
-- wa.me exige un numéro international sans + ni espace. Les clients saisissent
-- leur numéro sous toutes les formes (777793522, +221777793522, 0777793522…).
-- On stocke une version normalisée `221XXXXXXXXX` à côté du numéro saisi, tenue
-- à jour par trigger. NULL = numéro inexploitable (bouton WhatsApp masqué,
-- anomalie signalée dans l'admin).

-- 1. Fonction de normalisation (miroir de lib/whatsapp.ts).
create or replace function sacado_normaliser_tel_sn(saisi text)
returns text
language plpgsql
immutable
as $$
declare
  n text;
begin
  n := regexp_replace(coalesce(saisi, ''), '\D', '', 'g');
  if n = '' then
    return null;
  end if;

  -- 00221… -> 221…
  if left(n, 5) = '00221' then
    n := substr(n, 3);
  end if;

  if left(n, 3) = '221' and length(n) = 12 then
    return n;
  elsif length(n) = 9 and left(n, 1) = '7' then
    return '221' || n;
  elsif length(n) = 10 and left(n, 2) = '07' then
    return '221' || substr(n, 2);
  end if;

  return null;
end;
$$;

-- Préfixe mobile connu (70/75/76/77/78) ? Sert au signalement « douteux ».
create or replace function sacado_est_mobile_sn(normalise text)
returns boolean
language sql
immutable
as $$
  select normalise is not null
     and length(normalise) = 12
     and left(normalise, 3) = '221'
     and substr(normalise, 4, 2) in ('70', '75', '76', '77', '78');
$$;

-- 2. Colonnes.
alter table clients   add column if not exists telephone_normalise text;
alter table commandes add column if not exists telephone_normalise text;

create index if not exists idx_clients_telephone_normalise
  on clients (telephone_normalise);

-- 3. Backfill.
update clients
   set telephone_normalise = sacado_normaliser_tel_sn(telephone)
 where telephone_normalise is distinct from sacado_normaliser_tel_sn(telephone);

update commandes c
   set telephone_normalise = cl.telephone_normalise
  from clients cl
 where cl.id = c.client_id
   and c.telephone_normalise is distinct from cl.telephone_normalise;

-- 4. Triggers.
-- clients : normalise à partir du numéro saisi.
create or replace function sacado_clients_tel_normalise()
returns trigger
language plpgsql
as $$
begin
  new.telephone_normalise := sacado_normaliser_tel_sn(new.telephone);
  return new;
end;
$$;

drop trigger if exists trg_clients_tel_normalise on clients;
create trigger trg_clients_tel_normalise
  before insert or update of telephone on clients
  for each row execute function sacado_clients_tel_normalise();

-- commandes : recopie le numéro normalisé du client au moment de la commande
-- (le numéro de livraison de CETTE commande, figé même si le client corrige
-- son profil plus tard).
create or replace function sacado_commandes_tel_normalise()
returns trigger
language plpgsql
as $$
begin
  select telephone_normalise into new.telephone_normalise
    from clients where id = new.client_id;
  return new;
end;
$$;

drop trigger if exists trg_commandes_tel_normalise on commandes;
create trigger trg_commandes_tel_normalise
  before insert or update of client_id on commandes
  for each row execute function sacado_commandes_tel_normalise();

-- ============================================================================
-- Contrôles post-exécution
-- ============================================================================
-- select count(*) filter (where telephone_normalise is null) as douteux,
--        count(*) as total
--   from clients;
-- select telephone, telephone_normalise from clients
--  where telephone_normalise is null limit 20;
