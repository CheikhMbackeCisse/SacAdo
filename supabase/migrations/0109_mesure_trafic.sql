-- SacAdo — PROMPT_CLIENT_V2 Lot 5 : mesure de fréquentation côté client, pour
-- le tableau « Trafic » de l'admin (PROMPT_ADMIN_V2 Lot 3). À exécuter APRÈS
-- 0108, dans le SQL Editor Supabase. Idempotente.
--
-- Système séparé de `evenements` (migration 0046, classement accueil) : un
-- autre usage (audience/acquisition, pas score produit), une autre forme
-- (une ligne par visite/étape, pas par produit vu), une autre rétention (90 j
-- purgés, contre conservation longue pour `evenements`). Les mélanger aurait
-- rendu les deux requêtes illisibles.
--
-- 1. `visites_liens` : liens suivis créés dans l'admin (QR codes affiches,
--    campagnes) — juste un couple (utm_source, utm_campaign) nommé.
-- 2. `visites_sessions` : une ligne par session anonyme (`sacado_sid`), posée
--    UNE SEULE FOIS à la première visite (attribution "first touch") : source,
--    appareil, navigateur, app installée ou non. Mise à jour seulement pour
--    `derniere_activite_le` (sert les "visiteurs en ce moment").
-- 3. `visites_evenements` : une ligne par étape (page vue, produit vu, ajout/
--    retrait panier, début commande, commande validée, recherche, page 404).
-- 4. Purge à 90 jours (pg_cron, extension déjà créée en 0046).

-- 1. Liens suivis.
create table if not exists visites_liens (
  id          bigint generated always as identity primary key,
  code        text not null unique,
  utm_source  text not null,
  utm_campaign text not null,
  libelle     text,
  cree_le     timestamptz not null default now()
);

alter table visites_liens enable row level security;
-- Aucune policy publique : lecture/écriture réservées au service_role (admin).

-- 2. Sessions.
create table if not exists visites_sessions (
  session_id            text primary key,
  client_id             bigint references clients (id),
  cree_le               timestamptz not null default now(),
  derniere_activite_le  timestamptz not null default now(),
  source_type           text not null default 'direct' check (source_type in (
    'google_recherche', 'google_pub', 'affiche', 'whatsapp',
    'facebook', 'instagram', 'tiktok', 'autre_site', 'direct'
  )),
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  gclid         text,
  referent_host text,
  lien_id       bigint references visites_liens (id),
  appareil      text not null default 'autre' check (appareil in ('android', 'iphone', 'ordinateur', 'autre')),
  navigateur    text,
  app_installee boolean not null default false
);

alter table visites_sessions enable row level security;

create index if not exists idx_visites_sessions_derniere_activite on visites_sessions (derniere_activite_le);
create index if not exists idx_visites_sessions_cree_le on visites_sessions (cree_le);
create index if not exists idx_visites_sessions_lien_id on visites_sessions (lien_id) where lien_id is not null;

-- 3. Évènements.
create table if not exists visites_evenements (
  id          bigint generated always as identity primary key,
  session_id  text not null references visites_sessions (session_id) on delete cascade,
  type        text not null check (type in (
    'page_vue', 'produit_vu', 'ajout_panier', 'retrait_panier',
    'debut_commande', 'commande_validee', 'recherche', 'page_404'
  )),
  page        text,
  produit_id  bigint references produits (id),
  quantite    integer,
  prix_unitaire integer,
  recherche   text,
  recherche_sans_resultat boolean,
  commande_id bigint references commandes (id),
  cree_le     timestamptz not null default now()
);

alter table visites_evenements enable row level security;

create index if not exists idx_visites_evenements_session on visites_evenements (session_id);
create index if not exists idx_visites_evenements_type_date on visites_evenements (type, cree_le);
create index if not exists idx_visites_evenements_cree_le on visites_evenements (cree_le);

-- 4. Purge 90 jours (cf. 0046 pour l'extension pg_cron, déjà créée).
create or replace function purger_visites_anciennes() returns void as $$
begin
  delete from visites_evenements where cree_le < now() - interval '90 days';
  delete from visites_sessions where derniere_activite_le < now() - interval '90 days';
end;
$$ language plpgsql security definer;

revoke execute on function purger_visites_anciennes() from public, anon, authenticated;
grant execute on function purger_visites_anciennes() to service_role;

do $$
begin
  perform cron.unschedule('purger_visites_anciennes');
exception when others then
  null;
end $$;

select cron.schedule('purger_visites_anciennes', '30 3 * * *',
  $$ select public.purger_visites_anciennes(); $$);

-- 5. Visites par jour (RECAP du tableau Trafic) : agrégé en SQL, pas en JS,
-- pour rester rapide même avec un historique de 90 jours.
create or replace function visites_par_jour(p_depuis timestamptz)
returns table (jour date, visiteurs_uniques bigint, pages_vues bigint) as $$
  select
    date(cree_le) as jour,
    count(distinct session_id) as visiteurs_uniques,
    count(*) filter (where type = 'page_vue') as pages_vues
  from visites_evenements
  where cree_le >= p_depuis
  group by date(cree_le)
  order by jour;
$$ language sql stable;

revoke execute on function visites_par_jour(timestamptz) from public, anon, authenticated;
grant execute on function visites_par_jour(timestamptz) to service_role;

-- ============================================================================
-- Contrôles post-exécution
-- ============================================================================
-- 1. select * from visites_liens limit 5;
-- 2. Visiter le site en navigation privée -> une ligne apparaît dans
--    visites_sessions, puis une ou plusieurs dans visites_evenements
--    (type 'page_vue') au fil de la navigation.
-- 3. select * from visites_par_jour(now() - interval '7 days');
-- 4. select jobname, schedule, active from cron.job where jobname = 'purger_visites_anciennes';
