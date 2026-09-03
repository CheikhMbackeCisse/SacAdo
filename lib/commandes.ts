import type { StatutCommande, StatutPaiement } from "@/lib/supabase/types";

// 'paiement_en_attente' : commande Wave créée mais paiement pas encore confirmé
// par le webhook (INTEGRATION_WAVE.md). Elle existe en base et a réservé du
// stock, mais ne doit PAS être préparée, ni comptée dans le CA / les ventes,
// tant qu'elle n'est pas passée 'recue'.
export const STATUT_EN_ATTENTE_PAIEMENT: StatutCommande = "paiement_en_attente";

// Statuts d'une commande « réelle » (paiement acquis, ou paiement à la
// livraison) : tout sauf l'attente de paiement Wave.
export const STATUTS_COMMANDE_CONFIRMEE: StatutCommande[] = [
  "recue",
  "preparation",
  "livraison",
  "livree",
];

export function estCommandeConfirmee(statut: StatutCommande): boolean {
  return statut !== STATUT_EN_ATTENTE_PAIEMENT;
}

export const LIBELLES_STATUT_COMMANDE: Record<StatutCommande, string> = {
  paiement_en_attente: "En attente de paiement",
  recue: "Reçue",
  preparation: "En préparation",
  livraison: "En livraison",
  livree: "Livrée",
};

export const LIBELLES_STATUT_PAIEMENT: Record<StatutPaiement, string> = {
  en_attente: "En attente",
  payee: "Payée",
  echoue: "Échouée",
  annulee: "Annulée",
};
