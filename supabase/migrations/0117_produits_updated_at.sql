-- SacAdo — Date de dernière modification d'un produit (PROMPT_EXPORTS_ET_
-- CORRECTIONS.md Lot 1 : colonne demandée dans l'export Excel Produits).
-- Additive + idempotente. `updated_at` est posé automatiquement par un
-- trigger (même mécanique que `set_ebook_updated_at`, migration 0035) : aucun
-- code applicatif n'a besoin de le renseigner lui-même.

alter table produits add column if not exists updated_at timestamptz not null default now();

create or replace function set_produit_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_produits_updated_at on produits;
create trigger trg_produits_updated_at
  before update on produits
  for each row execute function set_produit_updated_at();

-- ============================================================================
-- Contrôle post-exécution
-- ============================================================================
-- select id, updated_at from produits order by updated_at desc limit 5;
