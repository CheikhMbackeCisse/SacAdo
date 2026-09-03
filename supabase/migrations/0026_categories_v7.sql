-- SacAdo — Corrections V7 : ordre des catégories + renommages (CORRECTIONS_V7 §4-5)
-- À exécuter APRÈS 0025, dans le SQL Editor Supabase.
-- Idempotent : peut être relancé sans erreur.
--
-- §4 : nouvel ordre validé. La grille d'accueil se remplit COLONNE PAR COLONNE
--   (2 rangées, grid-flow-col) => `ordre` séquentiel = haut col.1, bas col.1,
--   haut col.2, bas col.2, … Les 3 premières colonnes (ordre 1→6) mettent en
--   avant Informatique & Électronique.
-- §5 : « Matériel informatique » -> « Informatique » (seule occurrence visible,
--   tout le reste est lié par id). « Mobilier (tables, chaises) » -> « Mobilier ».
--   Les slugs ne changent pas (URLs, images, sous-catégories inchangées).

update categories set ordre = case slug
  when 'kits'                 then 1   -- col 1 haut
  when 'cahiers-papeterie'    then 2   -- col 1 bas
  when 'cartables-sacs'       then 3   -- col 2 haut
  when 'livres-manuels'       then 4   -- col 2 bas
  when 'ordinateurs'          then 5   -- col 3 haut  (Informatique)
  when 'electronique-arduino' then 6   -- col 3 bas   (Électronique)
  when 'geometrie'            then 7   -- col 4 haut
  when 'mobilier'             then 8   -- col 4 bas
  when 'hygiene-cantine'      then 9   -- col 5 haut
  when 'sport-eps'            then 10  -- col 5 bas
  when 'fournitures-ecole'    then 11  -- col 6 haut
  when 'art-dessin'           then 12  -- col 6 bas
  when 'ecriture'             then 13  -- col 7 haut
  when 'ebooks'               then 14  -- col 7 bas
  else ordre
end
where slug in (
  'kits','cahiers-papeterie','cartables-sacs','livres-manuels','ordinateurs',
  'electronique-arduino','geometrie','mobilier','hygiene-cantine','sport-eps',
  'fournitures-ecole','art-dessin','ecriture','ebooks'
);

update categories set nom = 'Informatique' where slug = 'ordinateurs';
update categories set nom = 'Mobilier'      where slug = 'mobilier';
