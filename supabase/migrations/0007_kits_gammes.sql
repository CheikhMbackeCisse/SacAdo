-- SacAdo — Lot 3 : gammes de kits (Essentiel / Confort / Complet)
-- Additive. À exécuter après 0006. Idempotence limitée : à ne lancer qu'une fois.
--
-- Chaque classe propose désormais 3 gammes :
--   - essentiel : l'indispensable, budget maîtrisé (= le kit existant)
--   - confort   : plus complet / meilleure qualité
--   - complet   : tout pour l'année, rien à racheter (plus d'articles pour les
--                 niveaux hauts)
-- L'ebook accompagne l'achat du kit complet de la classe QUELLE QUE SOIT la
-- gamme — géré en affichage côté app (pas de ligne à 0 FCFA en base pour l'instant).

-- ============================================================================
-- 1. Colonne gamme + contrainte d'unicité
-- ============================================================================
alter table kits
  add column gamme text not null default 'essentiel'
  check (gamme in ('essentiel', 'confort', 'complet'));

alter table kits drop constraint if exists kits_cycle_niveau_key;
alter table kits add constraint kits_cycle_niveau_gamme_key unique (cycle, niveau, gamme);

-- Les kits existants deviennent la gamme "essentiel" (défaut). On explicite le
-- nom pour distinguer les 3 gammes dans le back-office.
update kits set nom = nom || ' Essentiel' where gamme = 'essentiel';

-- ============================================================================
-- 2. Lignes Confort et Complet pour chaque classe existante
-- ============================================================================
insert into kits (cycle, niveau, nom, gamme)
select cycle, niveau, replace(nom, ' Essentiel', ' Confort'), 'confort'
from kits where gamme = 'essentiel';

insert into kits (cycle, niveau, nom, gamme)
select cycle, niveau, replace(nom, ' Essentiel', ' Complet'), 'complet'
from kits where gamme = 'essentiel';

-- ============================================================================
-- 3. Contenu Confort = Essentiel + montée en gamme
-- ============================================================================
insert into kit_items (kit_id, produit_id, quantite_defaut)
select kc.id, ki.produit_id, ki.quantite_defaut
from kits ke
join kits kc on kc.cycle = ke.cycle and kc.niveau = ke.niveau and kc.gamme = 'confort'
join kit_items ki on ki.kit_id = ke.id
where ke.gamme = 'essentiel';

-- Extras Confort : plus de quantité pour tenir l'année + articles de meilleure
-- qualité. on conflict : si l'article est déjà là, on ajuste la quantité.
insert into kit_items (kit_id, produit_id, quantite_defaut)
select k.id, p.id, i.q
from kits k
join (values
  ('Cahier 192 pages grand format', 2),
  ('Cahier 96 pages grand format', 6),
  ('Stylos bille noir (lot de 4)', 1),
  ('Gomme blanche', 2),
  ('Boîte de crayons de couleur (24 pièces)', 1),
  ('Bloc de dessin A4 (50 feuilles)', 1)
) as i(nom, q) on true
join produits p on p.nom = i.nom
where k.gamme = 'confort'
on conflict (kit_id, produit_id) do update set quantite_defaut = excluded.quantite_defaut;

-- ============================================================================
-- 4. Contenu Complet = Confort + tout pour l'année
-- ============================================================================
insert into kit_items (kit_id, produit_id, quantite_defaut)
select kp.id, ki.produit_id, ki.quantite_defaut
from kits kc
join kits kp on kp.cycle = kc.cycle and kp.niveau = kc.niveau and kp.gamme = 'complet'
join kit_items ki on ki.kit_id = kc.id
where kc.gamme = 'confort';

-- Extras Complet communs à toutes les classes
insert into kit_items (kit_id, produit_id, quantite_defaut)
select k.id, p.id, i.q
from kits k
join (values
  ('Cartable primaire renforcé', 1),
  ('Feutres correcteurs pointe fine (lot de 12)', 1),
  ('Pochettes plastique transparentes (lot de 5)', 2),
  ('Étiquettes autocollantes prénom (lot de 40)', 1),
  ('Set peinture gouache (12 couleurs)', 1),
  ('Pinceaux assortis (lot de 5)', 1)
) as i(nom, q) on true
join produits p on p.nom = i.nom
where k.gamme = 'complet'
on conflict (kit_id, produit_id) do update set quantite_defaut = excluded.quantite_defaut;

-- Extras Complet — niveaux hauts : le Complet ajoute davantage plus on monte.
-- CE2 → CM2 : dictionnaire.
insert into kit_items (kit_id, produit_id, quantite_defaut)
select k.id, p.id, 1
from kits k
join produits p on p.nom = 'Dictionnaire Le Petit Larousse Illustré'
where k.gamme = 'complet' and k.cycle = 'elementaire' and k.niveau in ('CE2', 'CM1', 'CM2')
on conflict (kit_id, produit_id) do nothing;

-- CM1 / CM2 : ramette A4 pour l'année.
insert into kit_items (kit_id, produit_id, quantite_defaut)
select k.id, p.id, 1
from kits k
join produits p on p.nom = 'Ramette papier A4 (500 feuilles)'
where k.gamme = 'complet' and k.cycle = 'elementaire' and k.niveau in ('CM1', 'CM2')
on conflict (kit_id, produit_id) do nothing;
