-- SacAdo — passage des 3 zones génériques (Dakar/Thiès/Autres régions) aux
-- 14 régions officielles du Sénégal, chacune avec ses propres tarifs 5j/24h.
-- Tarifs provisoires (paliers croissants avec l'éloignement de Dakar, le hub
-- logistique) : à ajuster à volonté depuis l'admin (Zones), aucun impact code.

update zones set tarif_5j = 500, tarif_24h = 1500 where nom = 'Dakar';
update zones set tarif_5j = 1500, tarif_24h = 3000 where nom = 'Thiès';

insert into zones (nom, tarif_5j, tarif_24h) values
  ('Diourbel', 2500, 4500),
  ('Fatick', 2500, 4500),
  ('Kaolack', 2500, 4500),
  ('Louga', 2500, 4500),
  ('Saint-Louis', 2500, 4500),
  ('Kaffrine', 3500, 6000),
  ('Kolda', 3500, 6000),
  ('Sédhiou', 3500, 6000),
  ('Tambacounda', 3500, 6000),
  ('Matam', 3500, 6000),
  ('Ziguinchor', 3500, 6000),
  ('Kédougou', 3500, 6000)
on conflict (nom) do nothing;

-- "Autres régions" n'a plus lieu d'être maintenant que les 14 régions sont
-- couvertes explicitement. Supprimée seulement si rien ne la référence déjà
-- (sinon laissée telle quelle pour ne rien casser sur des commandes de test).
do $$
begin
  delete from zones where nom = 'Autres régions';
exception when foreign_key_violation then
  raise notice 'Zone "Autres régions" conservée : encore référencée par des données existantes (client ou commande de test).';
end $$;
