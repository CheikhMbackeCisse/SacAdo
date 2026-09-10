-- SacAdo — Suivi des recherches sans résultat (TACHE_recherche_produits_v2.md §5)
-- À exécuter dans le SQL Editor Supabase, APRÈS 0041.
-- Additive + idempotente. Peut être rejouée.
--
-- 0041 a créé le journal brut `recherches_sans_resultat` (une ligne par
-- recherche vide). Il lui manque la DÉCISION de l'admin sur un terme, sinon
-- l'écran repropose éternellement les mêmes mots :
--   'synonyme'  : le terme a été rattaché à un groupe de `synonymes` — la
--                 recherche renvoie désormais des produits ;
--   'a_sourcer' : le produit n'est pas au catalogue, à faire entrer ;
--   'ignore'    : faute de frappe isolée, hors sujet, test.

alter table recherches_sans_resultat
  add column if not exists traitement text,
  add column if not exists traite_le timestamptz;

do $$
begin
  alter table recherches_sans_resultat
    add constraint recherches_sans_resultat_traitement_check
    check (traitement is null or traitement in ('synonyme', 'a_sourcer', 'ignore'));
exception
  when duplicate_object then null;
end $$;

-- Les décisions se posent sur toutes les lignes d'un même terme.
create index if not exists recherches_sans_resultat_terme_idx
  on recherches_sans_resultat (terme);

-- Termes déjà journalisés avant la normalisation à l'écriture (lib/recherche/
-- journal.ts) : on les aligne pour que le regroupement par fréquence et le
-- marquage retombent sur la même clé.
update recherches_sans_resultat
   set terme = btrim(regexp_replace(public.unaccent_immutable(lower(terme)), '\s+', ' ', 'g'))
 where terme <> btrim(regexp_replace(public.unaccent_immutable(lower(terme)), '\s+', ' ', 'g'));

-- ============================================================================
-- Contrôles post-exécution
-- ============================================================================
-- select terme, count(*), max(cree_le), max(traitement)
--   from recherches_sans_resultat group by terme order by count(*) desc limit 20;
