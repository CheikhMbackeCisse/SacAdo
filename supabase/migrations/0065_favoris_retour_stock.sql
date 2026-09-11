-- SacAdo — Favori de retour en stock (TACHE_notifications_client.md §2, §7 —
-- lot B6c). À exécuter APRÈS 0064. Idempotente.
--
-- Détection en base (transition stock 0 -> disponible), regroupement et envoi
-- une fois par jour via une route Next.js (push = Node/web-push, comme le
-- drainage des heures calmes, migration 0061). Réutilise le même secret
-- (CRON_PUSH_SECRET) et la même table de config, avec une 2e URL.

create table if not exists retours_stock (
  id         bigint generated always as identity primary key,
  produit_id bigint not null references produits (id) on delete cascade,
  remonte_le timestamptz not null default now(),
  traite     boolean not null default false
);
create index if not exists idx_retours_stock_a_traiter
  on retours_stock (remonte_le) where not traite;

alter table retours_stock enable row level security;
-- Aucune policy publique : lecture/écriture réservées au service_role.

create or replace function detecter_retour_stock() returns trigger as $$
begin
  if old.stock <= 0 and new.stock > 0 then
    insert into retours_stock (produit_id) values (new.id);
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_produits_retour_stock on produits;
create trigger trg_produits_retour_stock
  after update of stock on produits
  for each row execute function detecter_retour_stock();

-- Appelée une fois par jour (9h) : POST vers la route qui groupe par client et
-- envoie une notification par client (pas une par produit).
create or replace function public.drainer_retours_stock()
returns void
language plpgsql
security definer
set search_path = public, net
as $$
declare
  v_url    text;
  v_secret text;
begin
  select valeur into v_url    from config_cron_push where cle = 'restock_url';
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
  perform cron.unschedule('drain_retours_stock');
exception when others then
  null;
end $$;

select cron.schedule('drain_retours_stock', '0 9 * * *',
  $$ select public.drainer_retours_stock(); $$);

-- ============================================================================
-- Contrôles post-exécution
-- ============================================================================
-- select jobname, schedule, active from cron.job where jobname = 'drain_retours_stock';
-- Test : mettre le stock d'un produit à 0 puis à 5 -> une ligne dans retours_stock.
