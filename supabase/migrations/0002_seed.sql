-- SacAdo — données de démo (Lot 1)
-- À exécuter après 0001_schema.sql. Idempotent-friendly : à lancer sur une base vide.

-- ============================================================================
-- ZONES
-- ============================================================================
insert into zones (nom, tarif_5j, tarif_24h) values
  ('Dakar', 500, 1500),
  ('Thiès', 1500, 3000),
  ('Autres régions', 2500, 5000);

-- ============================================================================
-- PRODUITS (~34, répartis sur les 9 catégories de la grille accueil ;
-- "Kits scolaires" est la 10e catégorie, portée par la table kits)
-- ============================================================================
insert into produits (nom, categorie, prix, delai, photo, stock, seuil_alerte) values
  -- Cahiers & papeterie
  ('Cahier 96 pages grand format', 'Cahiers & papeterie', 500, '24h', '/images/prod-cahier-96p.jpg', 200, 20),
  ('Cahier 192 pages grand format', 'Cahiers & papeterie', 900, '24h', '/images/prod-cahier-192p.jpg', 150, 20),
  ('Cahier de brouillon 100 pages', 'Cahiers & papeterie', 350, '24h', '/images/prod-cahier-brouillon.jpg', 180, 20),
  ('Ramette papier A4 (500 feuilles)', 'Cahiers & papeterie', 3000, '24h', '/images/prod-ramette-a4.jpg', 60, 10),
  ('Pochettes plastique transparentes (lot de 5)', 'Cahiers & papeterie', 750, '24h', '/images/prod-pochettes.jpg', 100, 15),

  -- Écriture
  ('Stylos bille bleu (lot de 4)', 'Écriture', 600, '24h', '/images/prod-stylo-bleu.jpg', 220, 25),
  ('Stylos bille noir (lot de 4)', 'Écriture', 600, '24h', '/images/prod-stylo-noir.jpg', 200, 25),
  ('Crayons à papier HB (lot de 3)', 'Écriture', 500, '24h', '/images/prod-crayon-hb.jpg', 250, 25),
  ('Gomme blanche', 'Écriture', 150, '24h', '/images/prod-gomme.jpg', 300, 30),
  ('Taille-crayon métallique', 'Écriture', 200, '24h', '/images/prod-taille-crayon.jpg', 180, 20),
  ('Feutres correcteurs pointe fine (lot de 12)', 'Écriture', 3500, '24h', '/images/prod-feutres.jpg', 40, 10),

  -- Géométrie
  ('Compas métallique de précision', 'Géométrie', 1200, '24h', '/images/prod-compas.jpg', 90, 15),
  ('Équerre 25 cm', 'Géométrie', 500, '24h', '/images/prod-equerre.jpg', 100, 15),
  ('Rapporteur 180°', 'Géométrie', 400, '24h', '/images/prod-rapporteur.jpg', 100, 15),
  ('Règle plate 30 cm', 'Géométrie', 350, '24h', '/images/prod-regle-30.jpg', 150, 20),
  ('Calculatrice scientifique Casio FX-92', 'Géométrie', 12000, '5j', '/images/prod-casio-fx92.jpg', 25, 5),

  -- Cartables & sacs (avec variantes couleur)
  ('Cartable primaire renforcé', 'Cartables & sacs', 15000, '5j', '/images/prod-cartable-primaire.jpg', 60, 10),
  ('Sac à dos collège imperméable', 'Cartables & sacs', 18000, '5j', '/images/prod-sac-college.jpg', 45, 10),
  ('Trousse scolaire double compartiment', 'Cartables & sacs', 2500, '24h', '/images/prod-trousse.jpg', 80, 15),

  -- Livres & manuels
  ('Dictionnaire Le Petit Larousse Illustré', 'Livres & manuels', 9500, '5j', '/images/prod-larousse.jpg', 30, 5),
  ('Cahier d''exercices Mathématiques CE2', 'Livres & manuels', 2000, '24h', '/images/prod-exercices-ce2.jpg', 60, 10),
  ('Livre de lecture CP', 'Livres & manuels', 1800, '24h', '/images/prod-lecture-cp.jpg', 60, 10),

  -- Ordinateurs
  ('Ordinateur portable HP 15" (4Go/256Go SSD)', 'Ordinateurs', 285000, '5j', '/images/prod-hp-15.jpg', 8, 2),
  ('Souris optique USB', 'Ordinateurs', 3500, '24h', '/images/prod-souris.jpg', 50, 10),
  ('Clé USB 32 Go', 'Ordinateurs', 4500, '24h', '/images/prod-cle-usb.jpg', 70, 15),

  -- Électronique & Arduino
  ('Kit Arduino débutant (starter kit)', 'Électronique & Arduino', 25000, '5j', '/images/prod-arduino-kit.jpg', 3, 5),
  ('Calculatrice graphique Casio FX-CG50', 'Électronique & Arduino', 45000, '5j', '/images/prod-casio-cg50.jpg', 0, 3),

  -- Art & dessin
  ('Boîte de crayons de couleur (24 pièces)', 'Art & dessin', 2200, '24h', '/images/prod-crayons-couleur.jpg', 90, 15),
  ('Set peinture gouache (12 couleurs)', 'Art & dessin', 2800, '24h', '/images/prod-gouache.jpg', 60, 10),
  ('Pinceaux assortis (lot de 5)', 'Art & dessin', 1000, '24h', '/images/prod-pinceaux.jpg', 90, 15),
  ('Bloc de dessin A4 (50 feuilles)', 'Art & dessin', 1500, '24h', '/images/prod-bloc-dessin.jpg', 70, 10),

  -- Fournitures d'école (avec variantes taille)
  ('Tablier blouse écolier', 'Fournitures d''école', 4500, '24h', '/images/prod-tablier.jpg', 100, 15),
  ('Ardoise blanche + feutre effaçable', 'Fournitures d''école', 1200, '24h', '/images/prod-ardoise.jpg', 100, 15),
  ('Étiquettes autocollantes prénom (lot de 40)', 'Fournitures d''école', 1000, '24h', '/images/prod-etiquettes.jpg', 120, 20);

-- Deux cas de démo pour l'admin : "Kit Arduino débutant" sous le seuil d'alerte (3 <= 5),
-- "Calculatrice graphique Casio FX-CG50" à 0 => statut "epuise" (déclenché par le trigger).

-- ============================================================================
-- PRODUIT_VARIANTES
-- ============================================================================
insert into produit_variantes (produit_id, couleur, stock, photo)
select p.id, v.couleur, v.stock, v.photo from (
  values
    ('Cartable primaire renforcé', 'Bleu', 20, '/images/prod-cartable-primaire-bleu.jpg'),
    ('Cartable primaire renforcé', 'Rose', 20, '/images/prod-cartable-primaire-rose.jpg'),
    ('Cartable primaire renforcé', 'Gris', 20, '/images/prod-cartable-primaire-gris.jpg'),
    ('Sac à dos collège imperméable', 'Noir', 15, '/images/prod-sac-college-noir.jpg'),
    ('Sac à dos collège imperméable', 'Bleu marine', 15, '/images/prod-sac-college-marine.jpg'),
    ('Sac à dos collège imperméable', 'Gris', 15, '/images/prod-sac-college-gris.jpg')
) as v(nom, couleur, stock, photo)
join produits p on p.nom = v.nom;

insert into produit_variantes (produit_id, taille, stock)
select p.id, v.taille, v.stock from (
  values
    ('Tablier blouse écolier', 'S', 25),
    ('Tablier blouse écolier', 'M', 25),
    ('Tablier blouse écolier', 'L', 25),
    ('Tablier blouse écolier', 'XL', 25)
) as v(nom, taille, stock)
join produits p on p.nom = v.nom;

-- ============================================================================
-- KITS — Élémentaire, CI à CM2
-- ============================================================================
insert into kits (cycle, niveau, nom) values
  ('elementaire', 'CI', 'Kit CI'),
  ('elementaire', 'CP', 'Kit CP'),
  ('elementaire', 'CE1', 'Kit CE1'),
  ('elementaire', 'CE2', 'Kit CE2'),
  ('elementaire', 'CM1', 'Kit CM1'),
  ('elementaire', 'CM2', 'Kit CM2');

-- Socle commun à tous les kits élémentaire : fournitures de base
insert into kit_items (kit_id, produit_id, quantite_defaut)
select k.id, p.id, i.quantite from kits k
join (
  values
    ('Cahier 96 pages grand format', 4),
    ('Stylos bille bleu (lot de 4)', 1),
    ('Crayons à papier HB (lot de 3)', 1),
    ('Gomme blanche', 1),
    ('Taille-crayon métallique', 1),
    ('Règle plate 30 cm', 1),
    ('Trousse scolaire double compartiment', 1),
    ('Ardoise blanche + feutre effaçable', 1)
) as i(nom, quantite) on true
join produits p on p.nom = i.nom
where k.cycle = 'elementaire';

-- CE2, CM1, CM2 : géométrie en plus (compas, équerre, rapporteur)
insert into kit_items (kit_id, produit_id, quantite_defaut)
select k.id, p.id, i.quantite from kits k
join (
  values
    ('Compas métallique de précision', 1),
    ('Équerre 25 cm', 1),
    ('Rapporteur 180°', 1)
) as i(nom, quantite) on true
join produits p on p.nom = i.nom
where k.cycle = 'elementaire' and k.niveau in ('CE2', 'CM1', 'CM2');

-- CM1, CM2 : calculatrice scientifique en plus
insert into kit_items (kit_id, produit_id, quantite_defaut)
select k.id, p.id, 1 from kits k
join produits p on p.nom = 'Calculatrice scientifique Casio FX-92'
where k.cycle = 'elementaire' and k.niveau in ('CM1', 'CM2');
