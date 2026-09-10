-- SacAdo — Localités en liste de suggestions (TACHE_corrections_commande_theme_admin.md §2)
-- À exécuter APRÈS 0052, dans le SQL Editor Supabase. Additive + idempotente.
--
-- Le champ de localité du checkout devient une VRAIE liste de suggestions :
-- plus aucune saisie libre acceptée. Pour que « these » retrouve « Thiès » et
-- « poly » retrouve « École Polytechnique de Thiès », on stocke une forme
-- normalisée (minuscules, sans accents, espaces resserrés) remplie par trigger,
-- avec la même fonction `unaccent_immutable` que la recherche produit (0041).
--
-- Note : le cahier parle d'une table `zones_livraison` ; le projet a déjà
-- `zones` (nom, tarif_24h, tarif_6j) réutilisée comme « groupes de livraison »
-- depuis 0034. On NE crée PAS de table en double. Seul `localites` évolue ici.

create extension if not exists unaccent;

alter table localites add column if not exists nom_normalise text;

create or replace function localites_normaliser()
returns trigger
language plpgsql
as $$
begin
  new.nom_normalise :=
    btrim(regexp_replace(public.unaccent_immutable(lower(new.nom)), '\s+', ' ', 'g'));
  return new;
end;
$$;

drop trigger if exists localites_normaliser_trg on localites;
create trigger localites_normaliser_trg
  before insert or update of nom on localites
  for each row execute function localites_normaliser();

-- Backfill des lignes existantes.
update localites
   set nom_normalise =
     btrim(regexp_replace(public.unaccent_immutable(lower(nom)), '\s+', ' ', 'g'))
 where nom_normalise is distinct from
     btrim(regexp_replace(public.unaccent_immutable(lower(nom)), '\s+', ' ', 'g'));

alter table localites alter column nom_normalise set not null;

-- Recherche par préfixe/sous-chaîne côté serveur si besoin, + garde-fou
-- « Thiès » vs « thies » (une seule entrée par localité).
create index if not exists localites_nom_normalise_idx on localites (nom_normalise);
create unique index if not exists localites_nom_normalise_key on localites (nom_normalise);

-- ============================================================================
-- Contrôles post-exécution
-- ============================================================================
-- select nom, nom_normalise from localites order by nom_normalise limit 20;
-- select nom_normalise, count(*) from localites group by nom_normalise having count(*) > 1;
