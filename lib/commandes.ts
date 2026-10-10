import type { StatutCommande, StatutPaiement } from "@/lib/supabase/types";

// 'paiement_en_attente' : commande Wave créée mais paiement pas encore confirmé
// par le webhook (INTEGRATION_WAVE.md). Elle existe en base et a réservé du
// stock, mais ne doit PAS être préparée, ni comptée dans le CA / les ventes,
// tant qu'elle n'est pas passée 'recue'.
export const STATUT_EN_ATTENTE_PAIEMENT: StatutCommande = "paiement_en_attente";

// Statuts d'une commande « réelle » (paiement acquis, ou paiement à la
// livraison) : tout sauf l'attente de paiement Wave. 'annulee' en est
// délibérément exclue (void, ne compte jamais comme une vente).
export const STATUTS_COMMANDE_CONFIRMEE: StatutCommande[] = [
  "a_confirmer_appel",
  "recue",
  "preparation",
  "livraison",
  "livree",
  "probleme",
];

// 'annulee' : jamais comptée comme CA/vente, même si ce n'est pas une
// attente de paiement Wave (migration 0105).
export function estCommandeConfirmee(statut: StatutCommande): boolean {
  return statut !== STATUT_EN_ATTENTE_PAIEMENT && statut !== "annulee";
}

// Deux grands onglets de /admin/commandes (TACHE_commandes_fournisseurs_
// promo_express.md Lot 1) : une commande attend encore une action (appel ou
// paiement) avant d'être une vraie vente, ou elle est déjà effectuée.
// 'probleme' et 'annulee' sont volontairement exclus des deux : ce sont des
// puces à part, ni l'une ni l'autre.
export const STATUTS_COMMANDE_EN_ATTENTE: StatutCommande[] = ["a_confirmer_appel", "paiement_en_attente"];
export const STATUTS_COMMANDE_EFFECTUEE: StatutCommande[] = ["recue", "preparation", "livraison", "livree"];

export function estCommandeEnAttente(statut: StatutCommande): boolean {
  return STATUTS_COMMANDE_EN_ATTENTE.includes(statut);
}

export function estCommandeEffectuee(statut: StatutCommande): boolean {
  return STATUTS_COMMANDE_EFFECTUEE.includes(statut);
}

// Vente confirmée au sens du CA / des compteurs admin : une commande pas
// encore confirmée par appel ou paiement n'est pas encore une vente.
// 'probleme' reste compté (c'était déjà une vente confirmée avant l'incident).
export function estVenteConfirmee(statut: StatutCommande): boolean {
  return estCommandeEffectuee(statut) || statut === "probleme";
}

export const LIBELLES_STATUT_COMMANDE: Record<StatutCommande, string> = {
  paiement_en_attente: "En attente de paiement",
  a_confirmer_appel: "À confirmer par appel",
  recue: "Reçue",
  preparation: "En préparation",
  livraison: "En livraison",
  livree: "Livrée",
  probleme: "Souci en cours",
  annulee: "Annulée",
};

export const LIBELLES_STATUT_PAIEMENT: Record<StatutPaiement, string> = {
  en_attente: "En attente",
  payee: "Payée",
  echoue: "Échouée",
  annulee: "Annulée",
};

// Comment le point de livraison a été obtenu (PROMPT_CLIENT_LOCALISATION.md
// Lot 2, migration 0115) — affiché sur la fiche commande admin.
export const LIBELLES_SOURCE_LOCALISATION: Record<"position" | "lien" | "deplace", string> = {
  position: "position GPS",
  lien: "lien Google Maps",
  deplace: "point déplacé sur la carte",
};
