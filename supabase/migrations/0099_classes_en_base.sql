-- SacAdo — ADMIN.md Lot 3 : liste des classes déplacée en base (cycle, classe,
-- groupe, ordre d'affichage, actif). Remplace CYCLES[].classes et
-- CLASSES_LYCEE (lib/cycles.ts, lib/kits.ts) — source unique pour /kits,
-- l'admin, le sitemap et le profil "Mes sacados".
-- Idempotent : peut être relancé sans erreur.

create table if not exists classes (
  id bigint generated always as identity primary key,
  cycle text not null,
  classe text not null,
  -- Regroupement d'affichage (séries du lycée uniquement) ; null ailleurs.
  groupe text,
  ordre integer not null default 0,
  actif boolean not null default true,
  unique (cycle, classe)
);

create index if not exists idx_classes_cycle_ordre on classes (cycle, ordre);

alter table classes enable row level security;

drop policy if exists "classes visibles publiquement" on classes;
create policy "classes visibles publiquement" on classes for select using (true);
-- Pas de policy insert/update/delete : écriture réservée au serveur admin
-- (supabaseAdmin, service_role, qui ignore le RLS).

-- Reprise des listes actuelles de lib/cycles.ts et lib/kits.ts (CLASSES_LYCEE).
insert into classes (cycle, classe, groupe, ordre, actif) values
  ('prescolaire', 'Petite section', null, 1, true),
  ('prescolaire', 'Moyenne section', null, 2, true),
  ('prescolaire', 'Grande section', null, 3, true),
  ('elementaire', 'CI', null, 1, true),
  ('elementaire', 'CP', null, 2, true),
  ('elementaire', 'CE1', null, 3, true),
  ('elementaire', 'CE2', null, 4, true),
  ('elementaire', 'CM1', null, 5, true),
  ('elementaire', 'CM2', null, 6, true),
  ('college', '6e', null, 1, true),
  ('college', '5e', null, 2, true),
  ('college', '4e', null, 3, true),
  ('college', '3e', null, 4, true),
  ('lycee', 'Seconde L', 'Séries littéraires', 1, true),
  ('lycee', 'Seconde S', 'Séries scientifiques', 2, true),
  ('lycee', 'Seconde STEG', 'Gestion', 3, true),
  ('lycee', 'Seconde T', 'Technique', 4, true),
  ('lycee', 'Seconde SA', 'Séries arabes', 5, true),
  ('lycee', 'Seconde LA', 'Séries arabes', 6, true),
  ('lycee', 'Première L1', 'Séries littéraires', 7, true),
  ('lycee', 'Première L2', 'Séries littéraires', 8, true),
  ('lycee', 'Première S1', 'Séries scientifiques', 9, true),
  ('lycee', 'Première S2', 'Séries scientifiques', 10, true),
  ('lycee', 'Première STEG', 'Gestion', 11, true),
  ('lycee', 'Première T', 'Technique', 12, true),
  ('lycee', 'Première S1A', 'Séries arabes', 13, true),
  ('lycee', 'Première S2A', 'Séries arabes', 14, true),
  ('lycee', 'Première LA', 'Séries arabes', 15, true),
  ('lycee', 'Première L-AR', 'Séries arabes', 16, true),
  ('lycee', 'Terminale L1', 'Séries littéraires', 17, true),
  ('lycee', 'Terminale L2', 'Séries littéraires', 18, true),
  ('lycee', 'Terminale S1', 'Séries scientifiques', 19, true),
  ('lycee', 'Terminale S2', 'Séries scientifiques', 20, true),
  ('lycee', 'Terminale STEG', 'Gestion', 21, true),
  ('lycee', 'Terminale T', 'Technique', 22, true),
  ('lycee', 'Terminale S1A', 'Séries arabes', 23, true),
  ('lycee', 'Terminale S2A', 'Séries arabes', 24, true),
  ('lycee', 'Terminale LA', 'Séries arabes', 25, true),
  ('lycee', 'Terminale L-AR', 'Séries arabes', 26, true)
on conflict (cycle, classe) do nothing;
