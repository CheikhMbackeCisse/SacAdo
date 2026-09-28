// Message discret de fin de liste (CORRECTIONS_V11 lot 2) : distinct de
// DemanderProduit (qui invite à demander un produit manquant) — celui-ci
// confirme juste qu'il n'y a rien de plus à charger.
export function FinDeListe() {
  return <p className="pb-1 text-center text-xs text-ink/40">Vous avez tout vu.</p>;
}
