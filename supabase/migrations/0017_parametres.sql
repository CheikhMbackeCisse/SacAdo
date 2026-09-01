-- SacAdo — Marketplace V2 : paramètres réglables en admin
-- À exécuter APRÈS 0016, dans le SQL Editor Supabase.
-- Idempotent : peut être relancé sans erreur.
--
-- Petite table clé/valeur pour les réglages que l'admin doit pouvoir changer
-- sans redéploiement. Premier usage : la limite d'allers-retours d'une
-- négociation de prix (ESPACE_VENDEUR_NEGOCIATION.md §2 « garde-fou »).

create table if not exists parametres (
  cle text primary key,
  valeur text not null,
  description text,
  maj timestamptz not null default now()
);

alter table parametres enable row level security;

-- Lecture publique : aucune de ces valeurs n'est sensible, et l'espace vendeur
-- (client anon lié à la session) a besoin de connaître la limite de tours.
-- Écriture réservée au service_role (server action admin).
drop policy if exists "Lecture publique parametres" on parametres;
create policy "Lecture publique parametres" on parametres
  for select using (true);

insert into parametres (cle, valeur, description)
select
  'negociation_tours_max',
  '4',
  'Nombre maximum de propositions dans un fil de négociation de prix avant de devoir conclure (accepter ou abandonner).'
where not exists (select 1 from parametres where cle = 'negociation_tours_max');
