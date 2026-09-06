// Vendeur « SacAdo » : les produits achetés/vendus par SacAdo en propre y sont
// rattachés (migration 0036). Id fixe, aligné sur le seed de la migration.
//
// Ce vendeur est un cas à part : il n'a pas de compte, ne reçoit pas de
// reversement, et doit être EXCLU des calculs de dette vendeur (comptabilité)
// comme des listes de sélection de vendeurs marketplace.
export const VENDEUR_SACADO_ID = "00000000-0000-0000-0000-000000000001";

export function estVendeurSacAdo(vendeurId: string | null | undefined): boolean {
  return vendeurId === VENDEUR_SACADO_ID;
}
