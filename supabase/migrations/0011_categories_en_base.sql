-- SacAdo — Corrections V4 : catégories en base (table dédiée)
-- À exécuter après 0010. Additive + backfill + suppression de colonnes texte.
-- À ne lancer qu'une fois.
--
-- On règle la cause : les catégories vivaient en dur dans lib/categories.ts et
-- les sous-catégories / produits s'y rattachaient par texte. Désormais tout est
-- en base et lié par id stable (survit aux renommages).
--   - nouvelle table `categories` (seed = les 14 catégories de lib/categories.ts)
--   - sous_categories.categorie_slug (texte)  -> sous_categories.categorie_id (FK)
--   - produits.categorie (texte)              -> produits.categorie_id (FK)
-- Les icônes Lucide et les placeholders de recherche restent en code
-- (lib/category-presentation.ts), indexés par slug, avec repli.

-- ============================================================================
-- 1. Table categories + seed
-- ============================================================================
create table categories (
  id bigint generated always as identity primary key,
  nom text not null,
  slug text not null unique,
  ordre integer not null default 0,
  image text,
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

alter table categories enable row level security;
create policy "Lecture publique categories" on categories for select using (true);

insert into categories (slug, nom, ordre, image) values
  ('kits',                 'Kits scolaires',            1,  '/images/cat-kits.png'),
  ('cahiers-papeterie',    'Cahiers & papeterie',       2,  '/images/cat-cahiers-papeterie.jpg'),
  ('ecriture',             'Écriture',                  3,  '/images/cat-ecriture.webp'),
  ('geometrie',            'Matériel géométrique',      4,  '/images/cat-geometrie.jpg'),
  ('cartables-sacs',       'Cartables & sacs',          5,  '/images/cat-cartables-sacs.webp'),
  ('livres-manuels',       'Livres & manuels',          6,  '/images/cat-livres-manuels.jpg'),
  ('ordinateurs',          'Matériel informatique',     7,  '/images/cat-ordinateurs.jpg'),
  ('electronique-arduino', 'Électronique',              8,  '/images/cat-electronique-arduino.jpg'),
  ('art-dessin',           'Art & dessin',              9,  '/images/cat-art-dessin.jpg'),
  ('mobilier',             'Mobilier (tables, chaises)', 10, '/images/hero-coin-etude.jpg'),
  ('fournitures-ecole',    'Fournitures d''école',      11, '/images/cat-fournitures-ecole.jpg'),
  ('sport-eps',            'Sport & EPS',               12, '/images/cat-sport-eps.jpg'),
  ('hygiene-cantine',      'Hygiène & cantine',         13, '/images/cat-hygiene-cantine.png'),
  ('ebooks',               'Ebooks',                    14, '/images/cat-ebooks.webp');

-- ============================================================================
-- 2. sous_categories : categorie_slug -> categorie_id
-- ============================================================================
alter table sous_categories
  add column categorie_id bigint references categories (id) on delete cascade;

update sous_categories sc
  set categorie_id = c.id
  from categories c
  where c.slug = sc.categorie_slug;

-- Garde-fou : si une sous-catégorie n'a pas trouvé sa catégorie, on veut le savoir.
do $$
begin
  if exists (select 1 from sous_categories where categorie_id is null) then
    raise exception 'sous_categories orphelines après backfill categorie_id';
  end if;
end $$;

alter table sous_categories alter column categorie_id set not null;
alter table sous_categories drop constraint sous_categories_categorie_slug_slug_key;
alter table sous_categories add constraint sous_categories_categorie_id_slug_key unique (categorie_id, slug);
drop index if exists idx_sous_categories_categorie;
alter table sous_categories drop column categorie_slug;
create index idx_sous_categories_categorie_id on sous_categories (categorie_id);

-- ============================================================================
-- 3. produits : categorie (texte) -> categorie_id
-- ============================================================================
alter table produits
  add column categorie_id bigint references categories (id) on delete restrict;

update produits p
  set categorie_id = c.id
  from categories c
  join (values
    ('Cahiers & papeterie',    'cahiers-papeterie'),
    ('Écriture',               'ecriture'),
    ('Géométrie',              'geometrie'),
    ('Cartables & sacs',       'cartables-sacs'),
    ('Livres & manuels',       'livres-manuels'),
    ('Ordinateurs',            'ordinateurs'),
    ('Électronique & Arduino', 'electronique-arduino'),
    ('Art & dessin',           'art-dessin'),
    ('Mobilier',               'mobilier'),
    ('Fournitures d''école',   'fournitures-ecole'),
    ('Sport & EPS',            'sport-eps'),
    ('Hygiène & cantine',      'hygiene-cantine'),
    ('Ebooks',                 'ebooks')
  ) as m(nom_texte, slug) on m.slug = c.slug
  where p.categorie = m.nom_texte;

do $$
begin
  if exists (select 1 from produits where categorie_id is null) then
    raise exception 'produits sans categorie_id après backfill (valeur produits.categorie inconnue)';
  end if;
end $$;

alter table produits alter column categorie_id set not null;
drop index if exists idx_produits_categorie;
alter table produits drop column categorie;
create index idx_produits_categorie_id on produits (categorie_id);

-- ============================================================================
-- 4. suggestions_recherche : renvoyer le slug + le nom de la catégorie parente
--    (le header en a besoin pour le lien et le sous-titre « dans X »)
-- ============================================================================
create or replace function suggestions_recherche(p_terme text)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'produits', coalesce((
      select jsonb_agg(row_to_json(s))
      from (
        select p.id, p.nom, p.photo, p.prix, p.statut
        from produits p
        where texte_proche(p_terme, p.nom)
        order by
          (p.nom ilike btrim(p_terme) || '%') desc,
          word_similarity(btrim(p_terme), p.nom) desc,
          p.nom asc
        limit 6
      ) s
    ), '[]'::jsonb),
    'sous_categories', coalesce((
      select jsonb_agg(row_to_json(s))
      from (
        select sc.id, sc.nom, sc.slug,
               c.slug as categorie_slug, c.nom as categorie_nom
        from sous_categories sc
        join categories c on c.id = sc.categorie_id
        where length(btrim(p_terme)) > 1
          and (
            sc.nom ilike '%' || btrim(p_terme) || '%'
            or word_similarity(btrim(p_terme), sc.nom) > 0.5
          )
        order by
          (sc.nom ilike btrim(p_terme) || '%') desc,
          word_similarity(btrim(p_terme), sc.nom) desc,
          sc.nom asc
        limit 5
      ) s
    ), '[]'::jsonb)
  );
$$;

revoke execute on function suggestions_recherche(text) from public;
grant execute on function suggestions_recherche(text) to anon, authenticated;
