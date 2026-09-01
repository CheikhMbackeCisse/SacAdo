-- SacAdo — Marketplace V2 : unicité du nom de boutique
-- À exécuter APRÈS 0017, dans le SQL Editor Supabase.
-- Idempotent : peut être relancé sans erreur.
--
-- Deux vendeurs pouvaient choisir le même `nom_boutique` (rien ne l'empêchait).
-- On impose désormais un nom unique, insensible à la casse et aux espaces
-- superflus (le code applique déjà trim + collapse des espaces avant insertion,
-- cf. lib/vendeur/auth-actions.ts:nettoyerBoutique).

-- 1. Garde-fou : refuser la migration s'il reste des doublons à trancher à la
--    main (l'index unique échouerait de toute façon, mais avec un message obscur).
do $$
declare
  doublons text;
begin
  select string_agg(nom, ', ')
  into doublons
  from (
    select lower(nom_boutique) as nom
    from vendeurs
    group by lower(nom_boutique)
    having count(*) > 1
  ) d;

  if doublons is not null then
    raise exception
      'Noms de boutique en double, à corriger avant la migration : %', doublons;
  end if;
end $$;

-- 2. Unicité insensible à la casse.
create unique index if not exists vendeurs_nom_boutique_unique
  on vendeurs (lower(nom_boutique));
