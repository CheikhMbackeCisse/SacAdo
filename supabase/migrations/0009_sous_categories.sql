-- SacAdo — Corrections V4 : sous-catégories de produits
-- À exécuter après 0008. Additive. Idempotence limitée : à ne lancer qu'une fois.
--
-- Chaque produit appartient à UNE catégorie ET (optionnellement) UNE
-- sous-catégorie, pour trier et retrouver les articles quand le catalogue
-- grandit (rentrée). Réponse fondateur : table dédiée pré-remplie + écran admin.
--
-- Note de modèle : les CATÉGORIES vivent encore en dur dans `lib/categories.ts`
-- (pas de table `categories` en v1 — non prioritaire côté fondateur). On rattache
-- donc chaque sous-catégorie à sa catégorie par son `slug` (ex: 'livres-manuels'),
-- pas par un `categorie_id`. Le jour où les catégories passent en base, il suffira
-- d'ajouter une FK sans toucher aux données (le slug reste stable).

-- ============================================================================
-- 1. Table sous_categories
-- ============================================================================
create table sous_categories (
  id bigint generated always as identity primary key,
  nom text not null,
  -- slug de la catégorie parente, tel que défini dans lib/categories.ts
  categorie_slug text not null,
  -- slug de la sous-catégorie, unique dans sa catégorie ; sert au filtre client (?sc=)
  slug text not null,
  -- ordre d'affichage dans la rangée de filtres de la catégorie
  ordre integer not null default 0,
  created_at timestamptz not null default now(),
  unique (categorie_slug, slug)
);

create index idx_sous_categories_categorie on sous_categories (categorie_slug);

-- ============================================================================
-- 2. Lien produit -> sous-catégorie (nullable : un produit peut ne pas en avoir)
-- ============================================================================
alter table produits
  add column sous_categorie_id bigint references sous_categories (id) on delete set null;

create index idx_produits_sous_categorie on produits (sous_categorie_id);

-- ============================================================================
-- 3. Recherche tolérante aux fautes (utilisée au Lot B2 : suggestions live)
-- ============================================================================
-- pg_trgm : similarité par trigrammes -> "cahié", "chaier" retrouvent "cahier".
create extension if not exists pg_trgm;
create index idx_produits_nom_trgm on produits using gin (nom gin_trgm_ops);
create index idx_sous_categories_nom_trgm on sous_categories using gin (nom gin_trgm_ops);

-- ============================================================================
-- 4. RLS : lecture publique (catalogue), écriture réservée au back-office
-- ============================================================================
alter table sous_categories enable row level security;
create policy "Lecture publique sous_categories" on sous_categories for select using (true);

-- ============================================================================
-- 5. Seed : liste de départ complète, par catégorie (l'admin ajuste ensuite)
-- ============================================================================
insert into sous_categories (categorie_slug, nom, slug, ordre)
select v.categorie_slug, v.nom, v.slug, v.ordre
from (values
  -- Cahiers & papeterie
  ('cahiers-papeterie', 'Cahiers 96 pages',        'cahiers-96p',        1),
  ('cahiers-papeterie', 'Cahiers 192 pages',       'cahiers-192p',       2),
  ('cahiers-papeterie', 'Cahiers 200 pages',       'cahiers-200p',       3),
  ('cahiers-papeterie', 'Cahiers de travaux pratiques', 'cahiers-tp',    4),
  ('cahiers-papeterie', 'Cahiers de dessin',       'cahiers-dessin',     5),
  ('cahiers-papeterie', 'Cahiers de brouillon',    'cahiers-brouillon',  6),
  ('cahiers-papeterie', 'Protège-cahiers',         'protege-cahiers',    7),
  ('cahiers-papeterie', 'Papier & ramettes',       'papier-ramettes',    8),
  ('cahiers-papeterie', 'Pochettes & chemises',    'pochettes-chemises', 9),
  ('cahiers-papeterie', 'Blocs & répertoires',     'blocs-repertoires', 10),

  -- Écriture
  ('ecriture', 'Stylos',                 'stylos',              1),
  ('ecriture', 'Crayons à papier',       'crayons-papier',      2),
  ('ecriture', 'Crayons de couleur',     'crayons-couleur',     3),
  ('ecriture', 'Feutres',                'feutres',             4),
  ('ecriture', 'Surligneurs',            'surligneurs',         5),
  ('ecriture', 'Marqueurs',              'marqueurs',           6),
  ('ecriture', 'Correcteurs',            'correcteurs',         7),
  ('ecriture', 'Gommes & taille-crayons','gommes-taille-crayons', 8),
  ('ecriture', 'Encre & recharges',      'encre-recharges',     9),

  -- Géométrie
  ('geometrie', 'Compas',                'compas',       1),
  ('geometrie', 'Règles',                'regles',       2),
  ('geometrie', 'Équerres',              'equerres',     3),
  ('geometrie', 'Rapporteurs',           'rapporteurs',  4),
  ('geometrie', 'Kits de traçage',       'kits-tracage', 5),
  ('geometrie', 'Calculatrices',         'calculatrices',6),

  -- Cartables & sacs
  ('cartables-sacs', 'Cartables',        'cartables',       1),
  ('cartables-sacs', 'Sacs à dos',       'sacs-a-dos',      2),
  ('cartables-sacs', 'Sacs à roulettes', 'sacs-a-roulettes',3),
  ('cartables-sacs', 'Trousses',         'trousses',        4),
  ('cartables-sacs', 'Sacs de sport',    'sacs-de-sport',   5),

  -- Livres & manuels
  ('livres-manuels', 'Mathématiques',            'mathematiques',        1),
  ('livres-manuels', 'Physique-Chimie',          'physique-chimie',      2),
  ('livres-manuels', 'SVT',                      'svt',                  3),
  ('livres-manuels', 'Français',                 'francais',             4),
  ('livres-manuels', 'Philosophie',              'philosophie',          5),
  ('livres-manuels', 'Anglais',                  'anglais',              6),
  ('livres-manuels', 'Histoire-Géo',             'histoire-geo',         7),
  ('livres-manuels', 'Romans au programme',      'romans-au-programme',  8),
  ('livres-manuels', 'Parascolaire',             'parascolaire',         9),
  ('livres-manuels', 'Dictionnaires & encyclopédies', 'dictionnaires-encyclopedies', 10),
  ('livres-manuels', 'Préscolaire & élémentaire','prescolaire-elementaire', 11),

  -- Matériel informatique
  ('ordinateurs', 'Ordinateurs portables',     'ordinateurs-portables', 1),
  ('ordinateurs', 'Tablettes',                 'tablettes',             2),
  ('ordinateurs', 'Souris & claviers',         'souris-claviers',       3),
  ('ordinateurs', 'Clés USB & stockage',       'cles-usb-stockage',     4),
  ('ordinateurs', 'Sacoches & protection',     'sacoches-protection',   5),
  ('ordinateurs', 'Accessoires',               'accessoires-info',      6),

  -- Électronique
  ('electronique-arduino', 'Cartes Arduino',        'cartes-arduino',      1),
  ('electronique-arduino', 'Kits & modules',        'kits-modules',        2),
  ('electronique-arduino', 'Composants',            'composants',          3),
  ('electronique-arduino', 'Capteurs',              'capteurs',            4),
  ('electronique-arduino', 'Câbles & alimentation', 'cables-alimentation', 5),
  ('electronique-arduino', 'Calculatrices graphiques', 'calculatrices-graphiques', 6),

  -- Art & dessin
  ('art-dessin', 'Peinture & gouache',   'peinture-gouache',   1),
  ('art-dessin', 'Pinceaux',             'pinceaux',           2),
  ('art-dessin', 'Crayons & pastels',    'crayons-pastels',    3),
  ('art-dessin', 'Blocs & toiles',       'blocs-toiles',       4),
  ('art-dessin', 'Coloriage',            'coloriage',          5),
  ('art-dessin', 'Pâte à modeler',       'pate-a-modeler',     6),
  ('art-dessin', 'Accessoires d''art',   'accessoires-art',    7),

  -- Mobilier
  ('mobilier', 'Bureaux',            'bureaux',            1),
  ('mobilier', 'Chaises',            'chaises',            2),
  ('mobilier', 'Tables d''écolier',  'tables-ecolier',     3),
  ('mobilier', 'Rangement',          'rangement',          4),
  ('mobilier', 'Lampes de bureau',   'lampes-bureau',      5),

  -- Fournitures d'école
  ('fournitures-ecole', 'Tabliers & blouses', 'tabliers-blouses', 1),
  ('fournitures-ecole', 'Ardoises',           'ardoises',         2),
  ('fournitures-ecole', 'Étiquettes',         'etiquettes',       3),
  ('fournitures-ecole', 'Colle & adhésifs',   'colle-adhesifs',   4),
  ('fournitures-ecole', 'Ciseaux',            'ciseaux',          5),
  ('fournitures-ecole', 'Kits maternelle',    'kits-maternelle',  6),

  -- Sport & EPS
  ('sport-eps', 'Tenues de sport',   'tenues-sport',    1),
  ('sport-eps', 'Chaussures',        'chaussures',      2),
  ('sport-eps', 'Ballons',           'ballons',         3),
  ('sport-eps', 'Accessoires EPS',   'accessoires-eps', 4),
  ('sport-eps', 'Sacs de sport',     'sacs-sport-eps',  5),

  -- Hygiène & cantine
  ('hygiene-cantine', 'Gourdes',              'gourdes',            1),
  ('hygiene-cantine', 'Boîtes à goûter',      'boites-gouter',      2),
  ('hygiene-cantine', 'Lunch box',            'lunch-box',          3),
  ('hygiene-cantine', 'Trousses de toilette', 'trousses-toilette',  4),
  ('hygiene-cantine', 'Masques & gel',        'masques-gel',        5),
  ('hygiene-cantine', 'Serviettes',           'serviettes',         6),

  -- Ebooks
  ('ebooks', 'Annales & sujets',   'annales-sujets',   1),
  ('ebooks', 'Méthodologie',       'methodologie',     2),
  ('ebooks', 'Cours & résumés',    'cours-resumes',    3),
  ('ebooks', 'Lecture jeunesse',   'lecture-jeunesse', 4)
) as v(categorie_slug, nom, slug, ordre);

-- ============================================================================
-- 6. Rattachement des ~34 produits de démo à une sous-catégorie
-- ============================================================================
update produits p set sous_categorie_id = sc.id
from sous_categories sc, (values
  ('Cahier 96 pages grand format',            'cahiers-96p'),
  ('Cahier 192 pages grand format',           'cahiers-192p'),
  ('Cahier de brouillon 100 pages',           'cahiers-brouillon'),
  ('Ramette papier A4 (500 feuilles)',        'papier-ramettes'),
  ('Pochettes plastique transparentes (lot de 5)', 'pochettes-chemises'),
  ('Stylos bille bleu (lot de 4)',            'stylos'),
  ('Stylos bille noir (lot de 4)',            'stylos'),
  ('Crayons à papier HB (lot de 3)',          'crayons-papier'),
  ('Gomme blanche',                           'gommes-taille-crayons'),
  ('Taille-crayon métallique',                'gommes-taille-crayons'),
  ('Feutres correcteurs pointe fine (lot de 12)', 'correcteurs'),
  ('Compas métallique de précision',          'compas'),
  ('Équerre 25 cm',                           'equerres'),
  ('Rapporteur 180°',                         'rapporteurs'),
  ('Règle plate 30 cm',                       'regles'),
  ('Calculatrice scientifique Casio FX-92',   'calculatrices'),
  ('Cartable primaire renforcé',              'cartables'),
  ('Sac à dos collège imperméable',           'sacs-a-dos'),
  ('Trousse scolaire double compartiment',    'trousses'),
  ('Dictionnaire Le Petit Larousse Illustré', 'dictionnaires-encyclopedies'),
  ('Cahier d''exercices Mathématiques CE2',   'mathematiques'),
  ('Livre de lecture CP',                     'prescolaire-elementaire'),
  ('Ordinateur portable HP 15" (4Go/256Go SSD)', 'ordinateurs-portables'),
  ('Souris optique USB',                      'souris-claviers'),
  ('Clé USB 32 Go',                           'cles-usb-stockage'),
  ('Kit Arduino débutant (starter kit)',      'kits-modules'),
  ('Calculatrice graphique Casio FX-CG50',    'calculatrices-graphiques'),
  ('Boîte de crayons de couleur (24 pièces)', 'coloriage'),
  ('Set peinture gouache (12 couleurs)',      'peinture-gouache'),
  ('Pinceaux assortis (lot de 5)',            'pinceaux'),
  ('Bloc de dessin A4 (50 feuilles)',         'blocs-toiles'),
  ('Tablier blouse écolier',                  'tabliers-blouses'),
  ('Ardoise blanche + feutre effaçable',      'ardoises'),
  ('Étiquettes autocollantes prénom (lot de 40)', 'etiquettes')
) as m(nom, sc_slug)
where m.nom = p.nom and sc.slug = m.sc_slug;
