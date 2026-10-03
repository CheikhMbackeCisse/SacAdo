import type { ModePaiement } from "@/lib/supabase/types";

export type OptionsPaiement = {
  // Total de la commande (sous-total + livraison), en FCFA.
  total: number;
  // Plafond au-delà duquel le paiement à la livraison n'est plus proposé
  // (lib/parametres.ts::getPaiementLivraisonMax), null = pas de limite.
  paiementLivraisonMax: number | null;
  // Modes de paiement autorisés pour ce total.
  options: ModePaiement[];
  // true => 'wave' est le seul mode possible (total > paiementLivraisonMax).
  waveImpose: boolean;
};

// Règle du paiement (PROMPT_CLIENT_V2 Lot 1, remplace l'ancien seuil fixe de
// 10 000 FCFA) :
//   * Wave est toujours proposé (et sélectionné par défaut côté client) dès
//     qu'il est branché, quel que soit le montant.
//   * Le paiement à la livraison est proposé quel que soit le montant, SAUF
//     si l'admin a fixé un plafond (`paiementLivraisonMax`) et que le total
//     le dépasse : Wave devient alors le seul mode possible.
// `waveDisponible` = false quand Wave n'est pas branché (prod sans clés
// marchand) : on retombe sur le paiement à la livraison quel que soit le
// montant, le plafond ne s'applique pas (rien d'autre à proposer).
export function optionsPaiementPourTotal(
  total: number,
  waveDisponible = true,
  paiementLivraisonMax: number | null = null,
): OptionsPaiement {
  if (!waveDisponible) {
    return { total, paiementLivraisonMax, options: ["livraison"], waveImpose: false };
  }
  const waveImpose = paiementLivraisonMax !== null && total > paiementLivraisonMax;
  return {
    total,
    paiementLivraisonMax,
    options: waveImpose ? ["wave"] : ["livraison", "wave"],
    waveImpose,
  };
}

// Un mode de paiement est-il autorisé pour ce total ? (contrôle serveur : le
// mode envoyé par le client n'est jamais pris pour argent comptant.)
export function paiementAutorise(
  mode: ModePaiement,
  total: number,
  waveDisponible = true,
  paiementLivraisonMax: number | null = null,
): boolean {
  return optionsPaiementPourTotal(total, waveDisponible, paiementLivraisonMax).options.includes(mode);
}
