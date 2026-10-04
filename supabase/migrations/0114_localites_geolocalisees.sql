-- SacAdo — PROMPT_ADMIN_COMPTA_LOCALITES.md Lot 2 : localités géolocalisées.
-- À exécuter APRÈS 0113, dans le SQL Editor Supabase.
-- Idempotent : peut être relancé sans erreur.
--
-- `lat`/`lng` existent déjà sur `localites` depuis la migration 0034 (point de
-- référence, pas encore renseigné). On ajoute ici :
--   * rayon_km   : rayon de couverture autour du point de référence (défaut 3).
--   * zone_polygone : zone dessinée optionnelle (GeoJSON-like, [[lng,lat], …]),
--     qui l'emporte sur le rayon quand elle est renseignée. NULL = pas de zone,
--     on retombe sur le rayon.

alter table localites add column if not exists rayon_km numeric not null default 3 check (rayon_km > 0);
alter table localites add column if not exists zone_polygone jsonb;
