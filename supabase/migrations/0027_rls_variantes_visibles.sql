-- SacAdo — Sécurité : RLS des variantes alignée sur la visibilité du produit
-- À exécuter APRÈS 0026, dans le SQL Editor Supabase.
-- Idempotent : peut être relancé sans erreur.
--
-- Avant : `produit_variantes` et `variante_attributs` étaient en lecture
-- publique totale (`using (true)`, schéma d'origine 0001). Un tiers pouvait donc
-- interroger directement la base et lire le prix / le stock / les attributs des
-- variantes d'un produit vendeur PAS ENCORE PUBLIÉ (ids séquentiels =
-- énumérables). Pas de donnée personnelle, mais fuite d'info catalogue évitable.
--
-- Après : on n'expose une variante que si son produit parent est visible
-- (produit SacAdo, ou produit vendeur 'publie') — même règle que `produits`.
-- L'espace vendeur (service_role) et l'admin (service_role) contournent le RLS
-- et continuent de tout voir. Le storefront ne lit que des produits publiés,
-- donc rien ne change côté client.

drop policy if exists "Lecture publique produit_variantes" on produit_variantes;
create policy "Lecture publique produit_variantes" on produit_variantes
  for select using (
    exists (
      select 1 from produits p
      where p.id = produit_variantes.produit_id
        and (p.vendeur_id is null or p.statut_publication = 'publie')
    )
  );

drop policy if exists "Lecture publique variante_attributs" on variante_attributs;
create policy "Lecture publique variante_attributs" on variante_attributs
  for select using (
    exists (
      select 1
      from produit_variantes v
      join produits p on p.id = v.produit_id
      where v.id = variante_attributs.variante_id
        and (p.vendeur_id is null or p.statut_publication = 'publie')
    )
  );
