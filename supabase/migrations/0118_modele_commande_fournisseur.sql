-- SacAdo — TACHE_commandes_fournisseurs_promo_express.md Lot 2e : modèle de
-- message WhatsApp envoyé aux fournisseurs pour une commande d'achat.
-- À exécuter après 0117. Idempotente (on conflict do nothing).
--
-- Variables : {fournisseur} {reference} {liste_articles} {lien_bon}.

insert into modeles_messages (code, canal, libelle, titre, contenu, ordre) values
('commande_fournisseur', 'whatsapp', 'Commande fournisseur', null,
 E'Bonjour {fournisseur}, c''est SacAdo.\nVoici notre commande {reference} :\n{liste_articles}\n\nLes photos de chaque article sont ici : {lien_bon}\nDites-nous quand tout est prêt, on passe récupérer.', 1)
on conflict (code, canal) do nothing;

-- ============================================================================
-- Contrôle post-exécution
-- ============================================================================
-- select code, canal, contenu from modeles_messages where code = 'commande_fournisseur';
-- -> doit renvoyer une ligne (canal whatsapp).
