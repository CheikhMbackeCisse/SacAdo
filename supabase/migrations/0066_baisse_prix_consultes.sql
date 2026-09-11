-- SacAdo — Baisse de prix sur un produit consulté (TACHE_notifications_client.md
-- §2 — lot B6d). À exécuter APRÈS 0065. Idempotente.
--
-- Même architecture que le retour en stock (0065) : détection en base, envoi
-- via une route Next.js (push = Node), même secret et même table de config,
-- une 3e URL.

create table if not exists baisses_prix (
  id           bigint generated always as identity primary key,
  produit_id   bigint not null references produits (id) on delete cascade,
  ancien_prix  integer not null,
  nouveau_prix integer not null,
  baisse_le    timestamptz not null default now(),
  traite       boolean not null default false
);
create index if not exists idx_baisses_prix_a_traiter
  on baisses_prix (baisse_le) where not traite;

alter table baisses_prix enable row level security;
-- Aucune policy publique : lecture/écriture réservées au service_role.

create or replace function detecter_baisse_prix() returns trigger as $$
begin
  if new.prix < old.prix then
    insert into baisses_prix (produit_id, ancien_prix, nouveau_prix)
    values (new.id, old.prix, new.prix);
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_produits_baisse_prix on produits;
create trigger trg_produits_baisse_prix
  after update of prix on produits
  for each row execute function detecter_baisse_prix();

-- Appelée 1×/jour (9h30) : POST vers la route qui notifie les clients ayant
-- consulté un produit dont le prix a baissé.
create or replace function public.drainer_baisses_prix()
returns void
language plpgsql
security definer
set search_path = public, net
as $$
declare
  v_url    text;
  v_secret text;
begin
  select valeur into v_url    from config_cron_push where cle = 'baisse_prix_url';
  select valeur into v_secret from config_cron_push where cle = 'drain_secret';

  if v_url is null or v_secret is null then
    return; -- pas encore configuré
  end if;

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object('content-type', 'application/json', 'x-cron-secret', v_secret),
    body    := '{}'::jsonb
  );
end;
$$;

do $$
begin
  perform cron.unschedule('drain_baisses_prix');
exception when others then
  null;
end $$;

select cron.schedule('drain_baisses_prix', '30 9 * * *',
  $$ select public.drainer_baisses_prix(); $$);

-- ============================================================================
-- Contrôles post-exécution
-- ============================================================================
-- select jobname, schedule, active from cron.job where jobname = 'drain_baisses_prix';
-- Test : baisser le prix d'un produit -> une ligne dans baisses_prix.
