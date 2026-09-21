-- SacAdo — Mention du bénéficiaire Wave dans le message de confirmation
-- (TACHE_pages_legales_wave.md §6). À exécuter APRÈS 0083. Idempotente.
--
-- Ajoute "Bénéficiaire du paiement : UNISHOP SENEGAL" au modèle WhatsApp
-- envoyé quand un paiement Wave est confirmé (code 'paiement_recu'), pour
-- reprendre la même ligne que le récapitulatif de commande et l'écran de
-- paiement. Ne touche pas un modèle déjà édité manuellement par l'admin
-- (maj_le comparé à sa valeur de seed dans la migration 0057).

update modeles_messages
set contenu = contenu || E'\n\nBénéficiaire du paiement : UNISHOP SENEGAL',
    maj_le = now()
where code = 'paiement_recu'
  and canal = 'whatsapp'
  and contenu = '{prenom}, ton paiement Wave de {montant} FCFA est bien arrivé. Merci. On prépare ta commande n°{numero_commande}.';
