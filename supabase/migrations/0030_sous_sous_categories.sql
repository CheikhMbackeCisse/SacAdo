-- SacAdo — 3e niveau : sous-sous-catégories (optionnel)
-- Spec : SOUS_SOUS_CATEGORIES.md. À exécuter APRÈS 0029, dans le SQL Editor
-- Supabase. Additive. À ne lancer qu'une fois (le seed ferait doublon sinon).
--
-- Hiérarchie : Catégorie -> Sous-catégorie -> Sous-sous-catégorie (OPTIONNELLE).
-- Le 3e niveau n'existe QUE pour les sous-catégories où il est pertinent
-- (ex. Électronique -> Capteurs -> Capteurs de température / de mouvement…).
-- Là où ça n'a pas de sens (Cahiers 96 pages…), pas de 3e niveau : un produit
-- garde alors sous_sous_categorie_id = NULL.
--
-- Rattachement par id stable (comme categories / sous_categories), jamais par
-- texte. Création réservée à l'admin (service role) ; les vendeurs choisissent
-- parmi l'existant.

-- ============================================================================
-- 1. Table sous_sous_categories
-- ============================================================================
create table sous_sous_categories (
  id bigint generated always as identity primary key,
  nom text not null,
  -- slug unique dans sa sous-catégorie ; sert au filtre client (?ssc=)
  slug text not null,
  sous_categorie_id bigint not null references sous_categories (id) on delete cascade,
  -- ordre d'affichage dans la sous-catégorie
  ordre integer not null default 0,
  created_at timestamptz not null default now(),
  unique (sous_categorie_id, slug)
);

create index idx_sous_sous_categories_sous_categorie
  on sous_sous_categories (sous_categorie_id);

-- Recherche tolérante aux fautes (pg_trgm déjà activé en 0009).
create index idx_sous_sous_categories_nom_trgm
  on sous_sous_categories using gin (nom gin_trgm_ops);

-- ============================================================================
-- 2. Lien produit -> sous-sous-catégorie (NULLABLE)
--    NULL quand la sous-catégorie du produit n'a pas de 3e niveau.
-- ============================================================================
alter table produits
  add column sous_sous_categorie_id bigint
    references sous_sous_categories (id) on delete set null;

create index idx_produits_sous_sous_categorie
  on produits (sous_sous_categorie_id);

-- ============================================================================
-- 3. RLS : lecture publique (catalogue), écriture réservée au back-office
--    (les server actions admin passent par la clé service = bypass RLS).
-- ============================================================================
alter table sous_sous_categories enable row level security;
create policy "Lecture publique sous_sous_categories"
  on sous_sous_categories for select using (true);

-- ============================================================================
-- 4. Seed ciblé : uniquement là où le 3e niveau aide vraiment.
--    L'admin complètera / ajustera depuis l'écran Catégories.
--    Rattachement à la sous-catégorie par (categorie.slug, sous_categorie.slug).
-- ============================================================================
insert into sous_sous_categories (sous_categorie_id, nom, slug, ordre)
select sc.id, v.nom, v.slug, v.ordre
from (values
  -- Électronique -> Capteurs
  ('electronique-arduino', 'capteurs', 'Capteurs de température', 'capteurs-temperature', 1),
  ('electronique-arduino', 'capteurs', 'Capteurs de mouvement',   'capteurs-mouvement',   2),
  ('electronique-arduino', 'capteurs', 'Capteurs d''humidité',    'capteurs-humidite',    3),
  ('electronique-arduino', 'capteurs', 'Capteurs de distance',    'capteurs-distance',    4),
  ('electronique-arduino', 'capteurs', 'Capteurs de lumière',     'capteurs-lumiere',     5),
  ('electronique-arduino', 'capteurs', 'Capteurs de gaz',         'capteurs-gaz',         6),

  -- Électronique -> Cartes Arduino
  ('electronique-arduino', 'cartes-arduino', 'Arduino Uno',   'arduino-uno',   1),
  ('electronique-arduino', 'cartes-arduino', 'Arduino Nano',  'arduino-nano',  2),
  ('electronique-arduino', 'cartes-arduino', 'Arduino Mega',  'arduino-mega',  3),
  ('electronique-arduino', 'cartes-arduino', 'ESP32 / ESP8266','esp32-esp8266', 4),

  -- Électronique -> Composants
  ('electronique-arduino', 'composants', 'Résistances',            'resistances',   1),
  ('electronique-arduino', 'composants', 'Condensateurs',          'condensateurs', 2),
  ('electronique-arduino', 'composants', 'LED & afficheurs',       'led-afficheurs',3),
  ('electronique-arduino', 'composants', 'Transistors & diodes',   'transistors-diodes', 4),
  ('electronique-arduino', 'composants', 'Boutons & interrupteurs','boutons-interrupteurs', 5)
) as v(categorie_slug, sous_categorie_slug, nom, slug, ordre)
join categories c on c.slug = v.categorie_slug
join sous_categories sc on sc.categorie_id = c.id and sc.slug = v.sous_categorie_slug;

-- ============================================================================
-- 5. Garde-fou de cohérence : une sous-sous-catégorie posée sur un produit doit
--    appartenir à la sous-catégorie de ce produit (chaîne des 3 niveaux
--    toujours cohérente). Vaut pour les produits SacAdo comme vendeurs.
-- ============================================================================
create or replace function produit_coherence_sous_sous_categorie()
returns trigger
language plpgsql
as $$
begin
  if new.sous_sous_categorie_id is not null then
    if not exists (
      select 1 from sous_sous_categories ssc
      where ssc.id = new.sous_sous_categorie_id
        and ssc.sous_categorie_id is not distinct from new.sous_categorie_id
    ) then
      raise exception
        'sous_sous_categorie_id % hors de la sous-catégorie % du produit',
        new.sous_sous_categorie_id, new.sous_categorie_id;
    end if;
  end if;
  return new;
end
$$;

create trigger trg_produit_coherence_sous_sous_categorie
  before insert or update of sous_categorie_id, sous_sous_categorie_id on produits
  for each row execute function produit_coherence_sous_sous_categorie();

-- Note : aucun produit de démo n'est rattaché à un 3e niveau ici (les kits
-- Arduino de démo restent en sous-catégorie « Kits & modules »). L'admin range
-- les vrais produits électroniques dans le bon rayon depuis l'écran Catégories
-- et le formulaire produit.
