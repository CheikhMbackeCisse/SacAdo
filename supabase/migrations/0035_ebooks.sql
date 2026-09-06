-- SacAdo — Ebooks offerts avec les kits (MODULE_EBOOKS.md, Partie 1, lot 2)
-- À exécuter APRÈS 0034, dans le SQL Editor Supabase.
-- Idempotent : peut être relancé sans erreur.
--
-- Un ebook = un fichier PDF fourni par SacAdo, uploadé par l'admin, OFFERT à
-- l'achat d'un kit (pas de vente à l'unité, pas de personnalisation).
--   1. `ebooks` : le fichier (rangé dans le bucket privé `ebooks`) + son titre.
--   2. `ebook_classes` : quelle(s) classe(s) (cycle + niveau) reçoit quel ebook.
--      Une classe a AU PLUS un ebook ; un même ebook peut couvrir plusieurs
--      classes (ebook générique).
--   3. Bucket de stockage PRIVÉ `ebooks` : le PDF n'est jamais servi en public,
--      seulement via une URL signée générée côté serveur pour l'acheteur (lot 4).

-- ============================================================================
-- TABLES
-- ============================================================================
create table if not exists ebooks (
  id             bigint generated always as identity primary key,
  titre          text not null,
  fichier_chemin text not null,        -- chemin de l'objet dans le bucket `ebooks`
  taille_octets  bigint,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists ebook_classes (
  id       bigint generated always as identity primary key,
  ebook_id bigint not null references ebooks (id) on delete cascade,
  cycle    text not null check (cycle in ('prescolaire', 'elementaire', 'college', 'lycee')),
  niveau   text not null,
  unique (cycle, niveau)
);

create index if not exists idx_ebook_classes_ebook on ebook_classes (ebook_id);

-- ============================================================================
-- updated_at automatique sur `ebooks` (trace le remplacement du fichier)
-- ============================================================================
create or replace function set_ebook_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_ebooks_updated_at on ebooks;
create trigger trg_ebooks_updated_at
  before update on ebooks
  for each row execute function set_ebook_updated_at();

-- ============================================================================
-- RLS : aucun accès public
-- ============================================================================
-- Ni les ebooks ni leur association ne sont lisibles par le client. L'admin
-- gère tout via service_role (server actions). Le client télécharge SON ebook
-- via une server action qui vérifie son jeton puis signe l'URL (lot 4).
alter table ebooks        enable row level security;
alter table ebook_classes enable row level security;

-- ============================================================================
-- STOCKAGE : bucket PRIVÉ `ebooks`
-- ============================================================================
-- Contrairement à `produits` (public, servi dans les <img>), ce bucket reste
-- privé : upload et génération d'URL signée passent par service_role, aucune
-- policy pour anon / authenticated.
insert into storage.buckets (id, name, public)
values ('ebooks', 'ebooks', false)
on conflict (id) do nothing;
