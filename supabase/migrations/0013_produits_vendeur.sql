-- SacAdo — Marketplace V2, Lot 2 : produits vendeurs + file de modération
-- À exécuter APRÈS 0012, dans le SQL Editor Supabase.
--
--   1. `produits` gagne trois colonnes : le vendeur propriétaire (null = produit
--      SacAdo en propre), le statut de publication, et le motif de refus.
--   2. La lecture publique du catalogue est restreinte : un produit vendeur
--      n'apparaît côté client QUE s'il est 'publie'. Les produits SacAdo
--      (vendeur_id null) restent toujours visibles.
--   3. Un bucket de stockage public `produits` pour les photos uploadées par
--      les vendeurs (les produits SacAdo utilisent /public/images/).

-- ============================================================================
-- COLONNES
-- ============================================================================
alter table produits
  add column vendeur_id uuid references vendeurs (id) on delete cascade,
  add column statut_publication text not null default 'publie'
    check (statut_publication in ('en_attente', 'publie', 'refuse')),
  add column motif_refus text,
  -- Description libre (surtout utile pour les produits vendeurs). Nullable :
  -- les produits SacAdo existants n'en ont pas.
  add column description text;

create index idx_produits_vendeur on produits (vendeur_id);
create index idx_produits_statut_publication on produits (statut_publication);

-- Les lignes déjà en base sont des produits SacAdo : vendeur_id null +
-- 'publie' (valeurs par défaut) — rien à backfiller.

-- ============================================================================
-- RLS : lecture publique restreinte
-- ============================================================================
-- Avant : `using (true)`. Maintenant : produit SacAdo OU produit vendeur publié.
-- Les RPC de recherche (0010/0011) sont `language sql` sans security definer :
-- elles héritent de cette policy automatiquement. L'admin passe par service_role
-- (contourne le RLS) et continue de tout voir.
drop policy "Lecture publique produits" on produits;
create policy "Lecture publique produits" on produits
  for select using (vendeur_id is null or statut_publication = 'publie');

-- ============================================================================
-- STOCKAGE : bucket public pour les photos vendeurs
-- ============================================================================
-- Public en lecture (les <img> du catalogue). L'upload se fait côté serveur via
-- service_role (server action `televerserPhoto`), donc pas besoin de policy
-- d'écriture pour le rôle authenticated.
insert into storage.buckets (id, name, public)
values ('produits', 'produits', true)
on conflict (id) do nothing;
