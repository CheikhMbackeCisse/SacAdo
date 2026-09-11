-- SacAdo — Favoris & « déjà consultés » en base (TACHE_notifications_client.md
-- §2, lot B6 : nécessaires pour détecter un retour en stock ou une baisse de
-- prix côté serveur). À exécuter APRÈS 0063. Idempotente.
--
-- Même modèle que l'affinité de classement (migration 0049) : une paire de
-- tables session/compte. Anonyme tant que le visiteur n'a pas commandé
-- (clé = cookie `sacado_sid`), unifié par compte (clients.id) après, à travers
-- tous ses appareils. Écriture/lecture via service_role uniquement (identité
-- résolue côté serveur à partir du cookie, jamais fournie par le client).

create table if not exists favoris_session (
  session_id text not null,
  produit_id bigint not null references produits (id) on delete cascade,
  cree_le timestamptz not null default now(),
  primary key (session_id, produit_id)
);
create index if not exists idx_favoris_session_produit on favoris_session (produit_id);

create table if not exists favoris_compte (
  client_id bigint not null references clients (id) on delete cascade,
  produit_id bigint not null references produits (id) on delete cascade,
  cree_le timestamptz not null default now(),
  primary key (client_id, produit_id)
);
create index if not exists idx_favoris_compte_produit on favoris_compte (produit_id);

create table if not exists consultes_session (
  session_id text not null,
  produit_id bigint not null references produits (id) on delete cascade,
  vu_le timestamptz not null default now(),
  primary key (session_id, produit_id)
);

create table if not exists consultes_compte (
  client_id bigint not null references clients (id) on delete cascade,
  produit_id bigint not null references produits (id) on delete cascade,
  vu_le timestamptz not null default now(),
  primary key (client_id, produit_id)
);
create index if not exists idx_consultes_compte_client_vu on consultes_compte (client_id, vu_le desc);
create index if not exists idx_consultes_session_sid_vu on consultes_session (session_id, vu_le desc);

alter table favoris_session   enable row level security;
alter table favoris_compte    enable row level security;
alter table consultes_session enable row level security;
alter table consultes_compte  enable row level security;
-- Aucune policy publique : lecture/écriture réservées au service_role.

-- fusionner_session() (0049) gagne le rapatriement des favoris/consultés de la
-- session vers le compte, à la 1re commande — même geste que les affinités.
create or replace function public.fusionner_session(p_session text, p_client bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_session is null or p_client is null then
    return;
  end if;

  -- 1. Les affinités de session s'additionnent à celles du compte.
  insert into affinites_utilisateur (utilisateur_id, sous_categorie_id, poids)
  select p_client, s.sous_categorie_id, s.poids
  from affinites_session s
  where s.session_id = p_session
  on conflict (utilisateur_id, sous_categorie_id)
  do update set poids = affinites_utilisateur.poids + excluded.poids, maj_le = now();

  -- 2. Les événements passés de la session sont rattachés au compte.
  update evenements
     set client_id = p_client
   where session_id = p_session
     and client_id is null;

  -- 3. Favoris de la session -> compte (union, aucun favori perdu).
  insert into favoris_compte (client_id, produit_id, cree_le)
  select p_client, f.produit_id, f.cree_le
  from favoris_session f
  where f.session_id = p_session
  on conflict (client_id, produit_id) do nothing;

  -- 4. « Déjà consultés » de la session -> compte (garde la date la plus récente).
  insert into consultes_compte (client_id, produit_id, vu_le)
  select p_client, c.produit_id, c.vu_le
  from consultes_session c
  where c.session_id = p_session
  on conflict (client_id, produit_id)
  do update set vu_le = greatest(consultes_compte.vu_le, excluded.vu_le);

  -- 5. Les versions "session" sont vidées : le compte fait foi désormais.
  delete from affinites_session where session_id = p_session;
  delete from favoris_session   where session_id = p_session;
  delete from consultes_session where session_id = p_session;

  -- 6. Le lien session -> compte est mémorisé (affichage sans relire evenements).
  insert into sessions_comptes (session_id, compte_id)
  values (p_session, p_client)
  on conflict (session_id) do update set compte_id = excluded.compte_id, maj_le = now();
end $$;

-- ============================================================================
-- Contrôles post-exécution
-- ============================================================================
-- select count(*) from favoris_session; select count(*) from favoris_compte;
-- select count(*) from consultes_session; select count(*) from consultes_compte;
