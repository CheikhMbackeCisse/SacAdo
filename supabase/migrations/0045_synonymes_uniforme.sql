-- SacAdo — Synonyme manquant repéré en test manuel sur la prod (2026-09-10).
-- À exécuter APRÈS 0044. Additive, rejouable (on conflict do nothing).
--
-- "uniforme" / "uniforme scolaire" renvoyait 0 résultat alors que « Tablier
-- blouse écolier » est exactement ce qu'un parent sénégalais appelle ainsi.
-- Rattaché au groupe 28 existant (blouse, tablier, blouse d ecole).
insert into synonymes (groupe, terme) values
(28, 'uniforme'),
(28, 'uniforme scolaire')
on conflict (terme) do nothing;

-- Contrôle post-exécution :
-- select id, nom from rechercher_produits('uniforme', 10);
