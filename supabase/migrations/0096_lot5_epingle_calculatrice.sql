-- SacAdo — CORRECTIONS_V11 lot 5 : Casio fx-991ES Plus en avant sur l'accueil.
-- Exécutée directement par le fondateur dans le SQL Editor Supabase ; ce
-- fichier documente le changement pour l'historique des migrations.
--
-- Épingle le produit #1727 en position 1 du classement manuel de l'accueil
-- (positions 2 à 8, 10 et 11 déjà prises par d'autres épinglages). Relève son
-- seuil d'alerte stock à 5 : elle alimente 32 lignes de kits, le tableau de
-- bord admin (Alertes stock bas, déjà existant) préviendra automatiquement le
-- fondateur dès que le stock descendra à 5 ou moins.

insert into classement_manuel (produit_id, position, exclu)
values (1727, 1, false)
on conflict (produit_id) do update set position = 1, exclu = false;

update produits set seuil_alerte = 5 where id = 1727;

-- ============================================================================
-- Contrôles post-exécution
-- ============================================================================
-- select produit_id, position, exclu from classement_manuel where produit_id = 1727;
-- select id, nom, stock, seuil_alerte from produits where id = 1727;
