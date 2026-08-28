-- Prénom(s) de l'enfant / des enfants pour qui un kit est commandé : sert à
-- personnaliser l'ebook offert avec le kit. Champ libre, facultatif, saisi au
-- moment d'ajouter le kit au panier puis rattaché à la commande.
-- Format stocké : "Awa — Kit CP Confort ; Momar — Kit 6e Essentiel".
alter table commandes add column if not exists enfants_ebook text;
