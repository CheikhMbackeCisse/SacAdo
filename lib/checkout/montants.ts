import type { ModePaiement } from "@/lib/supabase/types";

// Règle du seuil de paiement (INTEGRATION_WAVE.md, lot W2).
//   * total < SEUIL  : le client CHOISIT — Wave d'avance OU à la livraison.
//   * total >= SEUIL : SEUL le paiement Wave d'avance est possible.
// Le total = sous-total + frais de livraison, TOUJOURS recalculé côté serveur.
export const SEUIL_PAIEMENT_AVANCE = 10000;

export type OptionsPaiement = {
  // Total de la commande (sous-total + livraison), en FCFA.
  total: number;
  seuil: number;
  // Modes de paiement autorisés pour ce total.
  options: ModePaiement[];
  // true => 'wave' est le seul mode possible (total >= seuil).
  waveImpose: boolean;
};

// `waveDisponible` = false quand Wave n'est pas branché (prod sans clés
// marchand) : on retombe alors sur le paiement à la livraison quel que soit le
// montant, la règle du seuil ne s'applique pas.
export function optionsPaiementPourTotal(
  total: number,
  waveDisponible = true,
): OptionsPaiement {
  if (!waveDisponible) {
    return { total, seuil: SEUIL_PAIEMENT_AVANCE, options: ["livraison"], waveImpose: false };
  }
  const waveImpose = total >= SEUIL_PAIEMENT_AVANCE;
  return {
    total,
    seuil: SEUIL_PAIEMENT_AVANCE,
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
): boolean {
  return optionsPaiementPourTotal(total, waveDisponible).options.includes(mode);
}
