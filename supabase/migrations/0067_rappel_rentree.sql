-- SacAdo — Rappel de rentrée par bénéficiaire (TACHE_notifications_client.md
-- §2 — lot B6e, dernier événement catalogue). À exécuter APRÈS 0066. Idempotente.
--
-- Contrairement au stock/prix, il n'y a pas d'événement déclencheur : c'est une
-- fenêtre calendaire (réutilise la saison « Rentrée scolaire » déjà posée pour
-- le classement, migration 0049). Une seule table de dédoublonnage empêche de
-- rappeler le même bénéficiaire tous les jours pendant les ~2 mois de la saison.

create table if not exists rappels_rentree_envoyes (
  beneficiaire_id bigint not null references beneficiaires (id) on delete cascade,
  annee           int not null,
  envoye_le       timestamptz not null default now(),
  primary key (beneficiaire_id, annee)
);

alter table rappels_rentree_envoyes enable row level security;
-- Aucune policy publique : lecture/écriture réservées au service_role.

-- Appelée tous les jours à 8h : n'appelle la route QUE si on est dans la
-- fenêtre de la saison « Rentrée scolaire » (sinon le job ne fait rien le
-- reste de l'année).
create or replace function public.drainer_rappels_rentree()
returns void
language plpgsql
security definer
set search_path = public, net
as $$
declare
  v_url    text;
  v_secret text;
  v_actif  boolean;
begin
  select exists(
    select 1 from saisons
     where actif
       and lower(nom) like '%rentr%'
       and current_date between debut and fin
  ) into v_actif;

  if not v_actif then
    return;
  end if;

  select valeur into v_url    from config_cron_push where cle = 'rappel_rentree_url';
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
  perform cron.unschedule('drain_rappels_rentree');
exception when others then
  null;
end $$;

select cron.schedule('drain_rappels_rentree', '0 8 * * *',
  $$ select public.drainer_rappels_rentree(); $$);

-- ============================================================================
-- Contrôles post-exécution
-- ============================================================================
-- select jobname, schedule, active from cron.job where jobname = 'drain_rappels_rentree';
-- select nom, debut, fin, actif from saisons where lower(nom) like '%rentr%';
