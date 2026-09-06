-- SacAdo — Ebook offert : classe(s) de kit rattachée(s) à une commande
-- (MODULE_EBOOKS.md, Partie 1, lot 4)
-- À exécuter APRÈS 0036, dans le SQL Editor Supabase.
-- Idempotent : peut être relancé sans erreur.
--
-- Une commande ne porte que des lignes produit : rien n'indique qu'un lot
-- d'articles vient d'un kit. On enregistre donc, au moment de l'ajout au panier,
-- la classe (cycle + niveau) de chaque kit ajouté, puis on la range ici à la
-- création de la commande. « Mes commandes » s'en sert pour proposer le
-- téléchargement de l'ebook de cette classe (si l'admin en a associé un).
--
-- Format : tableau JSON d'objets {cycle, niveau}, ex.
--   [{"cycle": "elementaire", "niveau": "CP"}, {"cycle": "college", "niveau": "6e"}]
-- NULL = commande sans kit.

alter table commandes add column if not exists ebook_classes jsonb;
