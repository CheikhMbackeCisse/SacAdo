-- SacAdo — Marketplace V2, Lot 1 : authentification vendeur + table `vendeurs`
-- À exécuter APRÈS 0011, dans le SQL Editor Supabase.
--
-- Ce lot fait deux choses :
--   1. Crée la table `vendeurs` (une fiche par compte Supabase Auth vendeur).
--   2. Crée la table `admins` et ferme un trou : jusqu'ici /admin n'exigeait que
--      « un utilisateur Supabase connecté ». Dès que des vendeurs pourront
--      s'inscrire en self-service (email/mot de passe ou Google), il faut
--      distinguer explicitement les rôles.

-- ============================================================================
-- ADMINS
-- ============================================================================
-- Liste blanche des comptes autorisés dans /admin. Le proxy et les server
-- actions vérifient l'appartenance à cette table (pas seulement « connecté »).
create table admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

alter table admins enable row level security;

-- Un utilisateur peut lire SA propre ligne : le proxy (client anon lié à la
-- session) doit pouvoir vérifier « suis-je admin ? ». Aucune policy d'écriture :
-- on ajoute/retire un admin uniquement via service_role (ou ce fichier).
create policy "Admin lit sa ligne" on admins
  for select using (auth.uid() = user_id);

-- Seed : au moment où cette migration tourne, le seul compte auth.users existant
-- est l'admin actuel (aucun vendeur ne s'est encore inscrit). On l'enregistre.
-- Si un jour tu ajoutes un admin : insert into admins (user_id, email) select id, email from auth.users where email = '...';
insert into admins (user_id, email)
select id, email from auth.users
on conflict (user_id) do nothing;

-- ============================================================================
-- VENDEURS
-- ============================================================================
-- Une fiche par compte vendeur. id = auth.users.id (le compte Supabase Auth,
-- créé par email/mot de passe OU par « Se connecter avec Google »).
create table vendeurs (
  id uuid primary key references auth.users (id) on delete cascade,
  nom_boutique text not null,
  contact_nom text,
  contact_telephone text,
  -- Comment on reverse le vendeur (Wave / Orange Money / …) — texte libre en v1.
  infos_reversement text,
  date_creation timestamptz not null default now()
);

alter table vendeurs enable row level security;

-- Un vendeur ne voit et ne modifie QUE sa fiche (MARKETPLACE_V2.md §8).
create policy "Vendeur lit sa fiche" on vendeurs
  for select using (auth.uid() = id);

create policy "Vendeur modifie sa fiche" on vendeurs
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Pas de policy INSERT : la fiche est créée côté serveur via service_role
-- (server action, juste après l'inscription / au premier passage OAuth).
