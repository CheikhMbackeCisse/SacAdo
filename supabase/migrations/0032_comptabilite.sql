-- SacAdo — GROUPE_B §2 : onglet Comptabilité (suivi de trésorerie admin)
-- À exécuter APRÈS 0031, dans le SQL Editor Supabase.
-- Idempotent : peut être relancé sans erreur.
--
-- Suivi de trésorerie simple (ni TVA, ni amortissements) :
--   * dépenses : saisie manuelle par l'admin (carburant, salaire chauffeur,
--     achat fournisseur, divers).
--   * commande_items.reverse_le : date à laquelle le montant net d'une ligne
--     vendeur (produit marketplace) a été effectivement reversé au vendeur.
--     NULL tant que ce n'est pas fait -> c'est la « dette vendeur » en cours.
--     Le montant net (prix - commission) est recalculé à la volée depuis la
--     table `commissions` (lib/commissions.ts) : pas de snapshot stocké, ce
--     n'est pas une compta légale.

create table if not exists depenses (
  id         bigint generated always as identity primary key,
  categorie  text not null check (categorie in ('carburant', 'salaire_chauffeur', 'achat_fournisseur', 'divers')),
  montant    integer not null check (montant > 0),
  date       date not null default current_date,
  note       text,
  created_at timestamptz not null default now()
);

create index if not exists idx_depenses_date on depenses (date);

alter table depenses enable row level security;
-- Aucune policy publique : données internes, accès service_role uniquement
-- (server actions admin), comme fournisseurs / clients / commandes.

alter table commande_items add column if not exists reverse_le timestamptz;
