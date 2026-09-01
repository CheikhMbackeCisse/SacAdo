-- SacAdo — Attributs de variantes créables (CORRECTIONS_DIVERSES_V6 §3)
-- À exécuter APRÈS 0021, dans le SQL Editor Supabase.
-- Idempotent : peut être relancé sans erreur.
--
-- Avant : produit_variantes portait deux colonnes figées `couleur` / `taille`.
-- Après : une variante porte 1..N valeurs d'attribut (Couleur=Bleu ET Taille=M).
-- Les attributs viennent d'une liste commune (seed d'attributs courants) ;
-- un vendeur peut en proposer un nouveau, l'admin valide / renomme / fusionne.

-- 1. Table des attributs.
create table if not exists attributs (
  id bigint generated always as identity primary key,
  nom text not null,
  statut text not null default 'valide' check (statut in ('propose', 'valide')),
  -- Vendeur à l'origine d'une proposition (null pour les attributs du socle).
  propose_par uuid references vendeurs (id) on delete set null,
  created_at timestamptz not null default now()
);
-- Unicité insensible à la casse : pas de « Couleur » / « couleur » / « COULEUR ».
create unique index if not exists attributs_nom_unique on attributs (lower(nom));

-- 2. Seed : attributs courants (validés d'office).
insert into attributs (nom, statut)
select t.v, 'valide'
from (values
  ('Couleur'), ('Taille'), ('Pointure'), ('Poids'), ('Contenance'),
  ('Matière'), ('Dimensions'), ('Capacité'), ('Nombre de pages'),
  ('Grammage'), ('Format'), ('Modèle'), ('Puissance'), ('Longueur'),
  ('Largeur'), ('Hauteur'), ('Parfum'), ('Motif'), ('Finition'),
  ('Langue'), ('Niveau scolaire'), ('Marque'), ('Genre'), ('Âge')
) as t(v)
where not exists (select 1 from attributs a where lower(a.nom) = lower(t.v));

-- 3. Valeurs d'attribut par variante.
create table if not exists variante_attributs (
  id bigint generated always as identity primary key,
  variante_id bigint not null references produit_variantes (id) on delete cascade,
  attribut_id bigint not null references attributs (id) on delete restrict,
  valeur text not null,
  unique (variante_id, attribut_id)
);
create index if not exists idx_variante_attributs_variante
  on variante_attributs (variante_id);

-- 4. Migration des données existantes : couleur / taille -> variante_attributs.
do $$
declare
  v_couleur_id bigint;
  v_taille_id bigint;
  a_couleur boolean := exists (
    select 1 from information_schema.columns
    where table_name = 'produit_variantes' and column_name = 'couleur'
  );
begin
  if a_couleur then
    select id into v_couleur_id from attributs where lower(nom) = 'couleur';
    select id into v_taille_id from attributs where lower(nom) = 'taille';

    insert into variante_attributs (variante_id, attribut_id, valeur)
    select id, v_couleur_id, couleur
    from produit_variantes
    where couleur is not null and couleur <> ''
    on conflict (variante_id, attribut_id) do nothing;

    insert into variante_attributs (variante_id, attribut_id, valeur)
    select id, v_taille_id, taille
    from produit_variantes
    where taille is not null and taille <> ''
    on conflict (variante_id, attribut_id) do nothing;
  end if;
end $$;

-- 5. Les colonnes figées (et leur contrainte d'unicité) ne servent plus.
alter table produit_variantes drop column if exists couleur cascade;
alter table produit_variantes drop column if exists taille cascade;

-- 6. RLS.
alter table attributs enable row level security;
alter table variante_attributs enable row level security;

drop policy if exists "Lecture publique attributs valides" on attributs;
create policy "Lecture publique attributs valides" on attributs
  for select using (statut = 'valide');

drop policy if exists "Lecture publique variante_attributs" on variante_attributs;
create policy "Lecture publique variante_attributs" on variante_attributs
  for select using (true);
