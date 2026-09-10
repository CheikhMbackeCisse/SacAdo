-- SacAdo — Message de livraison par destination
-- (TACHE_corrections_commande_theme_admin.md §3 + TACHE_corrections_2.md §1)
-- À exécuter APRÈS 0053. Additive + idempotente.
--
-- Certaines destinations n'ont pas de délai « 24h / 6j » qui ait du sens (EPT :
-- livraison groupée avant la rentrée). Quand une destination porte un message,
-- il REMPLACE le délai partout où il s'affiche (bandeau checkout, récap,
-- confirmation, suivi). Le prix, lui, reste affiché normalement.
--
-- Le cahier parle de `zones_livraison.message_special`. Dans ce projet :
--   * les lieux hors zone habituelle (EPT, gare de Thiès, Touba…) sont des
--     `lieux_speciaux` : ils ont déjà une colonne `message`.
--   * on ajoute `zones.message_special` pour pouvoir aussi personnaliser le
--     message d'un GROUPE de livraison entier si besoin (vide = délai normal).
-- Le message retenu est FIGÉ sur la commande (`commandes.message_livraison`)
-- pour l'afficher sans jointure et le garder stable si la source est modifiée.

alter table zones add column if not exists message_special text;
alter table commandes add column if not exists message_livraison text;

-- EPT : formulation retenue par Cheikh (remplace le texte de la spec).
update lieux_speciaux
   set message = 'Votre matériel scolaire vous sera amené à l''école avant la rentrée.'
 where lower(nom) like '%polytechnique%';

-- ============================================================================
-- Contrôle post-exécution
-- ============================================================================
-- select nom, mode, message from lieux_speciaux order by nom;
