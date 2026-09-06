-- SacAdo — Lieux connus (GROUPE_A_ui_kit_carte.md §2, repli geocoding manuel)
-- À exécuter APRÈS 0032, dans le SQL Editor Supabase.
-- Idempotent : peut être relancé sans erreur.
--
-- Un lieu connu = un repère fréquent (école, campus, marché...) saisi à la
-- main dans l'admin (/admin/lieux) avec ses coordonnées. Ces lieux remontent
-- EN PRIORITÉ dans la recherche d'adresse du checkout, même quand Nominatim
-- (OpenStreetMap) ne les trouve pas ou mal.

create table if not exists lieux_connus (
  id         bigint generated always as identity primary key,
  nom        text not null,
  lat        double precision not null,
  lng        double precision not null,
  created_at timestamptz not null default now()
);

alter table lieux_connus enable row level security;
-- Aucune policy publique : la recherche checkout passe par le proxy serveur
-- /api/geocoding (service_role), jamais par le client directement.

-- Quelques repères pour démarrer ; l'admin complète / corrige depuis /admin/lieux.
insert into lieux_connus (nom, lat, lng)
select v.nom, v.lat, v.lng
from (values
  ('École Polytechnique de Thiès (EPT)', 14.78896, -16.92460),
  ('Université Cheikh Anta Diop (UCAD), Dakar', 14.68280, -17.46340),
  ('Université de Thiès (UIDT)', 14.78330, -16.96670),
  ('Université Gaston Berger, Saint-Louis', 16.05000, -16.41670)
) as v(nom, lat, lng)
where not exists (select 1 from lieux_connus lc where lc.nom = v.nom);
