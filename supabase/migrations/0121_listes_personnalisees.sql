-- SacAdo — Listes personnalisées partageables (lot "créer un panier depuis
-- l'admin et donner le lien"). Contrairement aux kits scolaires (cycle/niveau/
-- gamme obligatoires, quantité figée) : titre libre, un seul lien public
-- réutilisable par plusieurs visiteurs, quantité ajustable par le client.

create table listes (
  id bigint generated always as identity primary key,
  -- Code court de l'URL publique /liste/[code] (lib/admin/listes-actions.ts
  -- ::genererCodeListe) : unique, généré une seule fois à la création.
  code text not null unique,
  titre text not null,
  description text,
  statut text not null default 'masque' check (statut in ('masque', 'publie')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_listes_code on listes (code);

create table liste_items (
  id bigint generated always as identity primary key,
  liste_id bigint not null references listes (id) on delete cascade,
  produit_id bigint not null references produits (id) on delete restrict,
  -- Quantité de DÉPART proposée au client côté page publique : lui seul peut
  -- l'augmenter/la diminuer (contrairement à kit_items.quantite_defaut, figée
  -- pour le client sur un kit scolaire).
  quantite_defaut integer not null default 1 check (quantite_defaut > 0),
  coche_defaut boolean not null default true,
  ordre int not null default 0,
  unique (liste_id, produit_id)
);

create index idx_liste_items_liste on liste_items (liste_id);

-- updated_at automatique (même mécanique que set_produit_updated_at, migration
-- 0117_produits_updated_at.sql).
create or replace function set_liste_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_listes_updated_at
  before update on listes
  for each row execute function set_liste_updated_at();

-- Remplacement atomique du contenu d'une liste (même modèle que
-- remplacer_kit_items, migration 0101_remplacer_kit_items.sql) : utilisé par
-- le réordonnancement (drag-and-drop) pour réécrire `ordre` sur toutes les
-- lignes en une seule transaction plutôt qu'en N updates séquentiels.
create or replace function remplacer_liste_items(p_liste_id bigint, p_items jsonb)
returns void as $$
begin
  delete from liste_items where liste_id = p_liste_id;

  insert into liste_items (liste_id, produit_id, quantite_defaut, coche_defaut, ordre)
  select
    p_liste_id,
    (item->>'produit_id')::bigint,
    (item->>'quantite_defaut')::integer,
    (item->>'coche_defaut')::boolean,
    (item->>'ordre')::integer
  from jsonb_array_elements(p_items) as item;
end;
$$ language plpgsql security definer;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
-- Même pattern que kits/kit_items (0001_schema.sql) : lecture publique non
-- filtrée par statut (le filtre `statut = 'publie'` est appliqué côté requête
-- applicative publique, lib/supabase/queries.ts::getListeParCode, jamais dans
-- la policy). Aucune policy d'écriture : tout passe par le service_role dans
-- les Server Actions admin (lib/admin/listes-actions.ts).
alter table listes enable row level security;
alter table liste_items enable row level security;

create policy "Lecture publique listes" on listes for select using (true);
create policy "Lecture publique liste_items" on liste_items for select using (true);

-- ============================================================================
-- Contrôles post-exécution
-- ============================================================================
-- 1. select proname from pg_proc where proname = 'remplacer_liste_items';
--    -> doit exister.
-- 2. insert into listes (code, titre) values ('test1234', 'Test');
--    -> doit réussir ; select * from listes where code = 'test1234';
-- 3. select tablename, policyname from pg_policies
--    where tablename in ('listes','liste_items');
--    -> 2 lignes "Lecture publique ...".
-- 4. delete from listes where code = 'test1234';
