import type { StatutDemandePreparation } from "@/lib/supabase/types";

// Référence lisible d'une demande de préparation (bon de préparation, listes).
export function refPreparation(id: number): string {
  return `PREP-${String(id).padStart(4, "0")}`;
}

export const LIBELLES_STATUT_DEMANDE: Record<StatutDemandePreparation, string> = {
  a_preparer: "À préparer",
  preparee: "Préparée",
};

// Statuts de commande dont les articles sont « à préparer » : la commande est
// confirmée mais pas encore partie en livraison.
export const STATUTS_COMMANDE_A_PREPARER = ["recue", "preparation"] as const;
