-- SacAdo — PROMPT_CLIENT_LOCALISATION.md Lot 2 : le point de livraison
-- détermine la localité et les frais, côté serveur. Le client ne choisit
-- plus sa localité dans une liste.
-- À exécuter APRÈS 0114, dans le SQL Editor Supabase.
-- Idempotent : peut être relancé sans erreur.

-- Comment le point a été obtenu (bouton "Ma position", lien Google Maps
-- collé, ou point déplacé/cliqué à la main sur la carte) — traçabilité pour
-- la fiche commande admin (§4). Simple champ descriptif, jamais utilisé pour
-- une décision métier.
alter table commandes add column if not exists source_localisation text
  check (source_localisation in ('position', 'lien', 'deplace'));

-- Distance (km) entre le point de livraison et le point de référence de la
-- localité retenue. NULL si hors couverture (aucune localité assez proche)
-- ou si un lieu spécial a été choisi à la place.
alter table commandes add column if not exists distance_localite_km numeric;
