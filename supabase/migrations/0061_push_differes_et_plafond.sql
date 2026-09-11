-- SacAdo — Envoi push au changement de statut : heures calmes + plafond
-- (TACHE_notifications_client.md §6-§7). À exécuter APRÈS 0060. Idempotente.
--
-- Le push exige du code Node (signature VAPID, bibliothèque web-push) : un
-- pg_cron seul ne peut pas l'envoyer. Le drainage à 7h se fait donc via
-- pg_net, qui appelle une route Next.js protégée par un secret. AUCUN secret
-- dans ce fichier (versionné) : la config réelle (URL + secret) est insérée à
-- part, donnée séparément.

create extension if not exists pg_net;

-- Config non publique (RLS activé, AUCUNE policy = accès service_role /
-- fonctions SECURITY DEFINER uniquement, jamais exposé à l'API publique).
create table if not exists config_cron_push (
  cle    text primary key,
  valeur text not null
);
alter table config_cron_push enable row level security;

-- File d'attente des push tombés en heures calmes (22h-7h, heure de Dakar =
-- UTC toute l'année, pas d'heure d'été). `envoye_le` NULL = pas encore drainé.
create table if not exists push_differes (
  id          bigint generated always as identity primary key,
  client_id   bigint not null references clients (id) on delete cascade,
  commande_id bigint references commandes (id) on delete set null,
  code_modele text,
  titre       text not null,
  corps       text not null,
  url         text not null,
  cree_le     timestamptz not null default now(),
  envoye_le   timestamptz
);

create index if not exists idx_push_differes_a_traiter
  on push_differes (cree_le)
  where envoye_le is null;

alter table push_differes enable row level security;
-- Aucune policy publique : lecture/écriture réservées au service_role.

-- Plafond de 3 push par commande (§7).
alter table commandes add column if not exists push_envoyes integer not null default 0;

-- Réservation atomique d'un envoi (immédiat ou différé) : incrémente le
-- compteur seulement si le plafond n'est pas atteint. Renvoie true si réservé.
create or replace function public.reserver_push_commande(p_commande_id bigint, p_max int)
returns boolean
language sql
as $$
  update commandes set push_envoyes = push_envoyes + 1
   where id = p_commande_id and push_envoyes < p_max
  returning true;
$$;

-- Appelée par pg_cron à 7h : POST vers la route de drainage. `net.http_post`
-- est asynchrone (mise en file côté Postgres) — la route fait le vrai travail.
create or replace function public.drainer_push_differes()
returns void
language plpgsql
security definer
set search_path = public, net
as $$
declare
  v_url    text;
  v_secret text;
begin
  select valeur into v_url    from config_cron_push where cle = 'drain_url';
  select valeur into v_secret from config_cron_push where cle = 'drain_secret';

  if v_url is null or v_secret is null then
    return; -- pas encore configuré (voir configuration à part)
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
  perform cron.unschedule('drain_push_differes');
exception when others then
  null;
end $$;

select cron.schedule('drain_push_differes', '0 7 * * *',
  $$ select public.drainer_push_differes(); $$);

-- ============================================================================
-- Contrôles post-exécution
-- ============================================================================
-- select jobname, schedule, active from cron.job where jobname = 'drain_push_differes';
-- select * from config_cron_push; -- doit être vide tant que la config à part n'est pas passée
