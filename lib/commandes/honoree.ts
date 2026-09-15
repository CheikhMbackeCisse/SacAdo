import "server-only";

export type CommandeStatutPaiement = {
  statut: string;
  mode_paiement: string;
  statut_paiement: string | null;
};

// Une commande donne droit à un contenu payé (ebook, notice de kit) une fois
// honorée : commande Wave passée à 'payee', ou commande à la livraison
// simplement confirmée (hors 'paiement_en_attente', propre aux sessions Wave
// non abouties). Partagé entre lib/ebooks/actions.ts et lib/documents/actions.ts.
export function commandeHonoree(commande: CommandeStatutPaiement): boolean {
  if (commande.statut === "paiement_en_attente") return false;
  if (commande.mode_paiement === "wave") return commande.statut_paiement === "payee";
  return true;
}
