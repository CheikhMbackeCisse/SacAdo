-- SacAdo — Fournisseurs (ADMIN_RESPONSIVE_ET_CARTE_LIVRAISON §2, CL-1)
-- À exécuter APRÈS 0027, dans le SQL Editor Supabase.
-- Idempotent : peut être relancé sans erreur.
--
-- Un fournisseur = un point où l'admin va récupérer de la marchandise
-- (Daradji, Yuupee, Thioune Teranga…). Saisi à la main dans l'admin, affiché
-- sur la carte « Livraisons » pour organiser les tournées. Pas de compte, pas
-- de flux automatisé (V2).

create table if not exists fournisseurs (
  id         bigint generated always as identity primary key,
  nom        text not null,
  adresse    text,
  lat        double precision,
  lng        double precision,
  created_at timestamptz not null default now()
);

alter table fournisseurs enable row level security;
-- Aucune policy publique : données internes, accès service_role uniquement
-- (server actions admin), comme clients / commandes.
