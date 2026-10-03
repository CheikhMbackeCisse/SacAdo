// Statuts sur lesquels un ajout à une commande reste possible (PROMPT_CLIENT_V2
// Lot 4) : tant qu'elle n'est pas "en_livraison"/"livree"/"annulee". 'probleme'
// exclue aussi (l'admin doit d'abord régler le souci). Doit rester aligné
// avec commande_modifiable_pour_ajout() (migration 0107). Fonction pure, pas
// de "use server" : utilisée aussi bien côté client (afficher ou non le
// bouton) que côté serveur (lib/ajout/actions.ts).
const STATUTS_MODIFIABLES = new Set(["a_confirmer_appel", "recue", "preparation"]);

export function commandeModifiablePourAjout(statut: string): boolean {
  return STATUTS_MODIFIABLES.has(statut);
}
