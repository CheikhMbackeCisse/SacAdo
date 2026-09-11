-- SacAdo — Modèles de messages éditables (TACHE_whatsapp_admin.md §5 +
-- TACHE_notifications_client.md §4). À exécuter APRÈS 0056. Idempotente.
--
-- Une ligne par (événement, canal). Le contenu porte des variables remplacées
-- à la génération : {prenom} {numero_commande} {montant} {localite} {articles}
-- {lien_commande} {lien_produit} {lien}. Éditable depuis /admin/modeles sans
-- redéploiement. Le ton tutoie, comme le reste de l'app.

create table if not exists modeles_messages (
  code    text not null,
  canal   text not null check (canal in ('whatsapp', 'push', 'inbox')),
  libelle text not null,               -- libellé du bouton (whatsapp) / repère admin
  titre   text,                        -- titre (push / inbox) ; NULL en whatsapp
  contenu text not null,
  ordre   int  not null default 0,     -- ordre d'affichage des boutons whatsapp
  actif   boolean not null default true,
  maj_le  timestamptz not null default now(),
  primary key (code, canal)
);

alter table modeles_messages enable row level security;
-- Lecture publique : le rendu des messages (in-app surtout) se fait côté
-- serveur avec service_role, mais la table ne contient aucune donnée
-- personnelle — on autorise la lecture anon pour rester souple.
drop policy if exists modeles_messages_lecture on modeles_messages;
create policy modeles_messages_lecture on modeles_messages for select using (true);
-- Écriture : service_role uniquement (server actions admin).

-- ---------------------------------------------------------------------------
-- Seed. `on conflict do nothing` : ne réécrit jamais un modèle déjà édité.
-- ---------------------------------------------------------------------------
insert into modeles_messages (code, canal, libelle, titre, contenu, ordre) values

-- Commande confirmée / reçue -----------------------------------------------
('commande_confirmee', 'whatsapp', 'Confirmer la commande', null,
 E'Salut {prenom}, c''est SacAdo. On a bien reçu ta commande n°{numero_commande} de {montant} FCFA. On te tient au courant dès qu''elle part.\n\nEnregistre ce numéro sous SacAdo pour recevoir le suivi de tes commandes.', 1),
('commande_confirmee', 'push', 'Commande reçue', 'Commande reçue',
 'Ta commande n°{numero_commande} est bien enregistrée.', 1),
('commande_confirmee', 'inbox', 'Commande reçue', 'Commande reçue',
 'Ta commande n°{numero_commande} de {montant} FCFA est bien enregistrée. On te prévient dès qu''elle part.', 1),

-- Paiement Wave reçu ------------------------------------------------------
('paiement_recu', 'whatsapp', 'Paiement reçu', null,
 '{prenom}, ton paiement Wave de {montant} FCFA est bien arrivé. Merci. On prépare ta commande n°{numero_commande}.', 2),
('paiement_recu', 'inbox', 'Paiement reçu', 'Paiement reçu',
 'Ton paiement Wave de {montant} FCFA est confirmé. On prépare ta commande n°{numero_commande}.', 2),

-- Commande en préparation (interne : in-app seulement) --------------------
('commande_preparation', 'inbox', 'Commande en préparation', 'Commande en préparation',
 'Ta commande n°{numero_commande} est en cours de préparation.', 3),

-- Commande en route ------------------------------------------------------
('commande_route', 'whatsapp', 'Commande en route', null,
 '{prenom}, ta commande n°{numero_commande} est en route vers {localite}. Le livreur t''appelle en arrivant.', 3),
('commande_route', 'push', 'Commande en route', 'Ta commande est en route',
 'Commande n°{numero_commande}, livraison à {localite}.', 3),
('commande_route', 'inbox', 'Commande en route', 'Commande en route',
 'Ta commande n°{numero_commande} est partie vers {localite}. Le livreur t''appelle en arrivant.', 3),

-- Commande livrée ------------------------------------------------------
('commande_livree', 'whatsapp', 'Commande livrée', null,
 '{prenom}, ta commande n°{numero_commande} est livrée. Si quelque chose ne va pas, réponds à ce message, on règle ça.', 4),
('commande_livree', 'push', 'Commande livrée', 'Commande livrée',
 'Ta commande n°{numero_commande} est arrivée.', 4),
('commande_livree', 'inbox', 'Commande livrée', 'Commande livrée',
 'Ta commande n°{numero_commande} est livrée. Merci de ta confiance !', 4),

-- Problème sur la commande --------------------------------------------
('commande_probleme', 'whatsapp', 'Article indisponible', null,
 '{prenom}, un souci sur ta commande n°{numero_commande} : {articles} n''est plus disponible chez notre fournisseur. On peut te proposer un remplacement ou te rembourser cette partie. Qu''est-ce que tu préfères ?', 5),
('commande_probleme', 'inbox', 'Souci sur la commande', 'Souci sur ta commande',
 'On a un souci sur ta commande n°{numero_commande}. On te contacte tout de suite par WhatsApp pour trouver une solution.', 5),

-- Adresse introuvable (message manuel, hors flux de statut) -----------
('adresse_introuvable', 'whatsapp', 'Adresse introuvable', null,
 '{prenom}, notre livreur est à {localite} mais n''arrive pas à te trouver. Tu peux nous envoyer un repère ou ta position ?', 6),

-- Produit demandé enfin trouvé --------------------------------------
('produit_trouve', 'whatsapp', 'Produit trouvé', null,
 '{prenom}, tu nous avais demandé un produit. On l''a trouvé, il est en ligne : {lien_produit}', 7),
('produit_trouve', 'push', 'Produit trouvé', 'Produit trouvé',
 'Le produit que tu cherchais est en ligne.', 7),
('produit_trouve', 'inbox', 'Produit trouvé', 'Produit trouvé',
 'Bonne nouvelle : le produit que tu nous avais demandé est disponible. {lien_produit}', 7),

-- Favori de retour en stock ---------------------------------------
('favori_restock', 'push', 'Favori de retour en stock', 'De retour en stock',
 'Un article de tes favoris est de nouveau disponible.', 8),
('favori_restock', 'inbox', 'Favori de retour en stock', 'De retour en stock',
 'Un ou plusieurs articles de tes favoris sont de nouveau disponibles.', 8),

-- Baisse de prix sur un produit consulté -------------------------
('baisse_prix', 'push', 'Baisse de prix', 'Baisse de prix',
 'Un produit que tu as consulté a baissé de prix.', 9),
('baisse_prix', 'inbox', 'Baisse de prix', 'Baisse de prix',
 'Un produit que tu avais regardé est passé à {montant} FCFA.', 9),

-- Rappel de rentrée par bénéficiaire ----------------------------
('rappel_rentree', 'push', 'Rappel de rentrée', 'Bientôt la rentrée',
 'Prépare le cartable de {prenom} sur SacAdo.', 10),
('rappel_rentree', 'inbox', 'Rappel de rentrée', 'Bientôt la rentrée',
 'La rentrée approche : le kit de {prenom} est prêt à commander sur SacAdo.', 10)

on conflict (code, canal) do nothing;

-- ============================================================================
-- Contrôle post-exécution
-- ============================================================================
-- select canal, count(*) from modeles_messages group by canal order by canal;
