-- SacAdo — Intégration catalogue livres Korka Diallo (TACHE_livres_korka_integration.md)
-- À exécuter dans le SQL Editor Supabase, après 0067. Idempotent (create or
-- replace / if not exists / delete+insert) : peut être relancé sans erreur.
--
-- Écarts assumés par rapport au document de tâche (voir plan/chat) :
--   - pas de nouvelle catégorie "Livres et annales" : on renomme et
--     restructure la catégorie existante `livres-manuels`.
--   - pas de table `produits_images` : on réutilise `produits.photos` (jsonb),
--     déjà en place avec un carrousel fonctionnel côté client.
--   - `ouvrage_id` est un bigint (cohérent avec `produits.id`), pas un uuid.

-- ============================================================================
-- 1. Colonnes produits — attributs livres + éditions
-- ============================================================================
alter table produits add column if not exists niveau text;
alter table produits add column if not exists serie text;
alter table produits add column if not exists matiere text;
alter table produits add column if not exists type_ouvrage text;
alter table produits add column if not exists auteur text;
alter table produits add column if not exists editeur text;
alter table produits add column if not exists edition text;
alter table produits add column if not exists edition_statut text;
alter table produits add column if not exists couverture_epreuves text;
alter table produits add column if not exists ouvrage_id bigint;

create index if not exists idx_produits_ouvrage on produits (ouvrage_id) where ouvrage_id is not null;

-- ============================================================================
-- 2. Catégorie "Livres & manuels" -> "Livres et annales" (slug inchangé)
-- ============================================================================
update categories set nom = 'Livres et annales' where slug = 'livres-manuels';

-- Remplace les 11 sous-catégories par matière par les 6 sous-catégories par
-- niveau demandées (§1.2-1.3). Les produits qui pointaient sur une ancienne
-- sous-catégorie perdent juste leur sous_categorie_id (on delete set null,
-- déjà en place depuis 0009) : seuls les 3 produits de démo sont concernés.
delete from sous_categories
where categorie_id = (select id from categories where slug = 'livres-manuels');

insert into sous_categories (categorie_id, nom, slug, ordre) values
  ((select id from categories where slug = 'livres-manuels'), 'Éveil et maternelle',      'eveil-maternelle',      1),
  ((select id from categories where slug = 'livres-manuels'), 'Collège',                  'college',               2),
  ((select id from categories where slug = 'livres-manuels'), 'Seconde',                  'seconde',               3),
  ((select id from categories where slug = 'livres-manuels'), 'Première',                 'premiere',              4),
  ((select id from categories where slug = 'livres-manuels'), 'Terminale',                'terminale',             5),
  ((select id from categories where slug = 'livres-manuels'), 'Concours et préparations', 'concours-preparations', 6);

-- ============================================================================
-- 3. Recherche : les nouveaux attributs alimentent recherche_texte
-- ============================================================================
create or replace function public.maj_index_recherche()
returns trigger
language plpgsql
as $$
declare
  v_cat   text;
  v_sous  text;
  v_ssous text;
begin
  select c.nom  into v_cat   from categories c            where c.id = new.categorie_id;
  select s.nom  into v_sous  from sous_categories s        where s.id = new.sous_categorie_id;
  select ss.nom into v_ssous from sous_sous_categories ss  where ss.id = new.sous_sous_categorie_id;

  new.nom_normalise := public.unaccent_immutable(lower(coalesce(new.nom, '')));

  new.recherche_texte := public.unaccent_immutable(lower(
      coalesce(new.nom, '')          || ' ' ||
      coalesce(new.description, '')  || ' ' ||
      coalesce(v_cat, '')            || ' ' ||
      coalesce(v_sous, '')           || ' ' ||
      coalesce(v_ssous, '')          || ' ' ||
      coalesce(new.mots_cles, '')    || ' ' ||
      coalesce(new.niveau, '')       || ' ' ||
      coalesce(new.serie, '')        || ' ' ||
      coalesce(new.matiere, '')      || ' ' ||
      coalesce(new.type_ouvrage, '') || ' ' ||
      coalesce(new.auteur, '')       || ' ' ||
      coalesce(new.editeur, '')
  ));
  return new;
end $$;

-- Réindexe l'existant (le trigger tourne, rien d'autre ne change).
update produits set nom = nom;

-- ============================================================================
-- 4. Synonymes (§1.6)
-- ============================================================================
insert into synonymes (groupe, terme) values
  (100,'annale'),(100,'annales'),(100,'anciennes epreuves'),(100,'sujets corriges'),
  (101,'concours general'),(101,'cg'),(101,'concours general senegalais'),
  (102,'bfem'),(102,'brevet'),(102,'troisieme'),(102,'3e'),
  (103,'bac'),(103,'baccalaureat'),(103,'terminale'),(103,'tle'),
  (104,'ems'),(104,'ecole militaire de sante'),(104,'sante militaire'),
  (105,'ept'),(105,'polytechnique'),(105,'ecole polytechnique de thies'),
  (106,'kaamile'),(106,'kamile'),(106,'kaamil'),
  (107,'cracks'),(107,'crack en maths'),(107,'cracks en maths'),
  (108,'mobama'),(108,'collection mobama'),
  (109,'didactikos'),(109,'edisah'),
  (110,'korka'),(110,'korka diallo'),(110,'thierno korka diallo'),
  (111,'cahier magique'),(111,'cahiers magiques'),(111,'cahier a rainures')
on conflict (terme) do nothing;

-- ============================================================================
-- 5. Classement : coefficient 0,5 sur les anciennes éditions (§3.5.2)
-- ============================================================================
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
        coalesce((p_affinites ->> (p.sous_categorie_id::text))::numeric, 0)) *
        case when p.edition_statut = 'ancienne' then 0.5 else 1 end as score_final
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
-- 6. Fournisseur "Korka Diallo" (§4.1)
-- ============================================================================
-- `fournisseurs` = points de retrait marchandise (carte Livraisons), pas une
-- fiche commerciale : la remise de 20 % est déjà portée par `prix_achat` de
-- chaque produit (= prix_vente × 0,8), rien à stocker ici en plus. Adresse à
-- compléter par le fondateur via /admin/fournisseurs si besoin pour la carte.
insert into fournisseurs (nom)
select 'Korka Diallo'
where not exists (select 1 from fournisseurs where nom = 'Korka Diallo');
