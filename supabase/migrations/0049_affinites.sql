-- SacAdo — Affinité personnelle, couche 2 (TACHE_algorithme_classement.md §3
-- couche 2 + TACHE_identite_et_beneficiaires.md Partie 1)
-- À exécuter dans le SQL Editor Supabase, APRÈS 0048.
-- Additive + idempotente. Peut être rejouée.
--
-- Le score global (couche 1) est le même pour tous. La couche 2 le multiplie
-- selon l'intérêt de chaque personne pour chaque sous-catégorie :
--   score_final = score_global * (1 + 0.6 * affinite_normalisee)
--
--   - `affinites_session`     : visiteur non connecté (clé = cookie `sacado_sid`)
--   - `affinites_utilisateur` : compte (clé = clients.id), après une commande
--   - `sessions_comptes`      : lien session -> compte, posé à la fusion, pour
--                               personnaliser l'affichage sans lire `evenements`
--   - `niveaux_categories`    : coups de pouce par niveau déclaré (démarrage à
--                               froid + §2.5)
--
-- Recalcul horaire par pg_cron (jamais à chaque événement). Fusion immédiate à
-- la première commande (bridge jusqu'au recalcul suivant).
--
-- L'affinité par BÉNÉFICIAIRE (parent avec plusieurs enfants) arrive au lot 4b.

-- ============================================================================
-- 1. Tables
-- ============================================================================
create table if not exists affinites_session (
  session_id text not null,
  sous_categorie_id bigint not null references sous_categories (id) on delete cascade,
  poids numeric not null default 0,
  maj_le timestamptz not null default now(),
  primary key (session_id, sous_categorie_id)
);
create index if not exists affinites_session_maj_le_idx on affinites_session (maj_le);

create table if not exists affinites_utilisateur (
  utilisateur_id bigint not null references clients (id) on delete cascade,
  sous_categorie_id bigint not null references sous_categories (id) on delete cascade,
  poids numeric not null default 0,
  maj_le timestamptz not null default now(),
  primary key (utilisateur_id, sous_categorie_id)
);

create table if not exists sessions_comptes (
  session_id text primary key,
  compte_id bigint not null references clients (id) on delete cascade,
  maj_le timestamptz not null default now()
);

create table if not exists niveaux_categories (
  niveau text not null,
  categorie_id bigint not null references categories (id) on delete cascade,
  coefficient numeric not null default 1.0 check (coefficient > 0),
  primary key (niveau, categorie_id)
);

-- Seed : coups de pouce par jeton de niveau (base + série + cycle). Modifiable
-- depuis l'admin (lot 5). Un niveau sans ligne = aucun coup de pouce.
insert into niveaux_categories (niveau, categorie_id, coefficient)
select v.niveau, c.id, v.coeff
from (values
  ('Terminale', 'geometrie',            1.6),
  ('Terminale', 'livres-manuels',       1.3),
  ('Première',  'geometrie',            1.4),
  ('Première',  'livres-manuels',       1.3),
  ('S',         'electronique-arduino', 1.4),
  ('S',         'art-dessin',           1.3),
  ('S',         'geometrie',            1.3),
  ('L',         'livres-manuels',       1.5),
  ('CI',        'fournitures-ecole',    1.6),
  ('CP',        'fournitures-ecole',    1.6),
  ('CE1',       'cahiers-papeterie',    1.3),
  ('CE2',       'cahiers-papeterie',    1.3),
  ('CM1',       'geometrie',            1.3),
  ('CM2',       'geometrie',            1.3),
  ('6e',        'livres-manuels',       1.4),
  ('6e',        'cahiers-papeterie',    1.3),
  ('5e',        'livres-manuels',       1.3),
  ('4e',        'livres-manuels',       1.3),
  ('3e',        'livres-manuels',       1.4),
  ('college',   'cartables-sacs',       1.2),
  ('lycee',     'ordinateurs',          1.2)
) as v(niveau, slug, coeff)
join categories c on c.slug = v.slug
on conflict (niveau, categorie_id) do nothing;

alter table affinites_session     enable row level security;
alter table affinites_utilisateur enable row level security;
alter table sessions_comptes      enable row level security;
alter table niveaux_categories    enable row level security;

-- ============================================================================
-- 2. calculer_affinites() — recalcul horaire
-- ============================================================================
create or replace function public.calculer_affinites()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  drop table if exists tmp_ev;
  drop table if exists tmp_aff_s;
  drop table if exists tmp_aff_u;

  -- Poids par événement : signal × décroissance (demi-vie 30 j), fenêtre 90 j.
  create temporary table tmp_ev on commit drop as
  select
    e.session_id,
    e.client_id,
    e.sous_categorie_id,
    (case e.type
       when 'commande'      then 5.0
       when 'ajout_panier'  then 3.0
       when 'recherche'     then 2.0
       when 'vue_produit'   then 1.0
       when 'vue_categorie' then 0.5
       else 0 end)
    * power(0.5, extract(epoch from now() - e.cree_le) / 86400.0 / 30.0) as poids
  from evenements e
  where e.sous_categorie_id is not null
    and e.cree_le >= now() - interval '90 days';

  -- Session : uniquement les événements encore anonymes (client_id null).
  create temporary table tmp_aff_s on commit drop as
  select session_id, sous_categorie_id, sum(poids) as poids
  from tmp_ev
  where client_id is null
  group by session_id, sous_categorie_id
  having sum(poids) > 0;

  -- Compte : les événements rattachés à un client (y compris ceux rebasculés
  -- par fusionner_session).
  create temporary table tmp_aff_u on commit drop as
  select client_id as utilisateur_id, sous_categorie_id, sum(poids) as poids
  from tmp_ev
  where client_id is not null
  group by client_id, sous_categorie_id
  having sum(poids) > 0;

  -- Bascule (une transaction : aucun état partiel visible).
  delete from affinites_session;
  insert into affinites_session (session_id, sous_categorie_id, poids)
  select session_id, sous_categorie_id, poids from tmp_aff_s;

  delete from affinites_utilisateur;
  insert into affinites_utilisateur (utilisateur_id, sous_categorie_id, poids)
  select utilisateur_id, sous_categorie_id, poids from tmp_aff_u;
end $$;

-- ============================================================================
-- 3. fusionner_session() — à la première commande / connexion
-- ============================================================================
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

  -- 3. La session anonyme est vidée…
  delete from affinites_session where session_id = p_session;

  -- 4. …et le lien session -> compte est mémorisé (affichage personnalisé
  --    à partir du seul cookie, sans relire `evenements`).
  insert into sessions_comptes (session_id, compte_id)
  values (p_session, p_client)
  on conflict (session_id) do update set compte_id = excluded.compte_id, maj_le = now();
end $$;

-- ============================================================================
-- 4. accueil_classement() — recalculé avec l'affinité en paramètre
-- ============================================================================
-- Remplace la version de 0048 : le score_final (global × affinité) est calculé
-- EN BASE à partir de la carte d'affinité fournie par l'appelant. Aucune lecture
-- de `evenements` ; tri sur `score_global` (indexé) + arithmétique.
drop function if exists public.accueil_classement(int);

create or replace function public.accueil_classement(
  p_limit int default 20,
  p_affinites jsonb default '{}'::jsonb,
  p_facteur numeric default 0.6
)
returns table (
  produit_id bigint,
  sous_categorie_id bigint,
  score_final numeric,
  epingle_position int,
  exploration_eligible boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with eligibles as (
    select
      p.id,
      p.sous_categorie_id,
      p.score_global,
      p.vues_30j,
      cm.position as epingle_position,
      p.score_global * (1 + p_facteur *
        coalesce((p_affinites ->> (p.sous_categorie_id::text))::numeric, 0)) as score_final
    from produits p
    left join classement_manuel cm on cm.produit_id = p.id
    where p.statut_publication = 'publie'
      and coalesce(cm.exclu, false) = false
      and (
        p.photo is not null
        or (jsonb_typeof(p.photos) = 'array' and jsonb_array_length(p.photos) > 0)
      )
      and p.stock > 0
      and p.statut <> 'epuise'
      and p.delai in ('24h', '6j')
  ),
  mediane as (
    -- Exploration : « score GLOBAL au-dessus de la médiane » (§4.2), pas le final.
    select percentile_cont(0.5) within group (order by el.score_global) as m
    from eligibles el
  ),
  classes as (
    select
      e.*,
      row_number() over (
        partition by e.sous_categorie_id
        order by e.score_final desc, e.id
      ) as rang_sc
    from eligibles e
  )
  select
    c.id,
    c.sous_categorie_id,
    c.score_final,
    c.epingle_position,
    (c.vues_30j < 50 and c.score_global > coalesce((select m from mediane), 0)) as exploration_eligible
  from classes c
  where c.rang_sc <= 3 or c.epingle_position is not null
  order by c.score_final desc, c.id
  limit greatest(p_limit * 10, 200);
$$;

grant execute on function public.accueil_classement(int, jsonb, numeric) to anon, authenticated;

-- ============================================================================
-- 5. Planification pg_cron — affinités toutes les heures
-- ============================================================================
do $$
begin
  perform cron.unschedule('affinites');
exception when others then
  null;
end $$;

select cron.schedule('affinites', '0 * * * *', $$ select public.calculer_affinites(); $$);

-- Premier calcul immédiat.
select public.calculer_affinites();

-- ============================================================================
-- Contrôles post-exécution
-- ============================================================================
-- select * from public.accueil_classement(20, '{}'::jsonb);
-- select count(*) from affinites_session;
-- select count(*) from affinites_utilisateur;
-- select jobname, schedule, active from cron.job where jobname in ('score_global','affinites');
