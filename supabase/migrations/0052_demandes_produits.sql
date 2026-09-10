-- SacAdo — Demandes de produits (TACHE_corrections_2.md §3)
-- À exécuter dans le SQL Editor Supabase. Additive + idempotente.
--
-- Le lien « Espace vendeur » quitte l'espace client ; à la place, un bouton
-- « Demander un produit » (écran Moi, recherche sans résultat, bas de chaque
-- catégorie). Cette table reçoit ces demandes. Elle est rapprochée, côté admin,
-- du journal `recherches_sans_resultat` dans la section « Ce que les clients
-- cherchent » : même information, deux angles.
--
-- Écriture via service_role (RLS active sans policy, comme recherches_sans_resultat).

create table if not exists demandes_produits (
  id uuid primary key default gen_random_uuid(),
  client_id bigint,             -- client identifié (jeton), sinon null (clients.id est numérique)
  session_id text,              -- cookie sacado_sid, pour recouper avec la navigation
  telephone text not null,      -- repris du compte ou saisi
  description text not null,     -- « ce que tu cherches » (seul champ obligatoire)
  precision_produit text,       -- marque, taille, modèle, quantité
  photo_url text,
  origine text,                 -- 'moi' | 'recherche_vide' | 'categorie'
  terme_recherche text,         -- rempli quand origine = 'recherche_vide'
  statut text not null default 'nouvelle',
  produit_id bigint,            -- rempli quand le produit entre au catalogue (produits.id est numérique)
  note_interne text,
  cree_le timestamptz not null default now(),
  maj_le timestamptz
);

do $$
begin
  alter table demandes_produits
    add constraint demandes_produits_statut_check
    check (statut in ('nouvelle', 'en_recherche', 'trouve', 'indisponible'));
exception
  when duplicate_object then null;
end $$;

-- Écran admin : nouvelles en premier.
create index if not exists demandes_produits_statut_cree_le_idx
  on demandes_produits (statut, cree_le desc);

alter table demandes_produits enable row level security;

-- ============================================================================
-- Contrôles post-exécution
-- ============================================================================
-- select statut, count(*) from demandes_produits group by statut;
