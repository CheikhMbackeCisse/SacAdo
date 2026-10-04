export function formatPrice(amount: number): string {
  return `${Math.round(amount).toLocaleString("fr-FR")} FCFA`;
}

// Unité de vente affichée après le prix (migrations 0083 + 0111) : `unite_vente`
// est une étiquette contrainte en base ('unite'|'paquet'|'lot'|'ramette'|'inconnu'),
// jamais le texte final — ce texte se construit ici, avec `quantite_conditionnement`
// quand l'étiquette en a besoin. null = rien à afficher (prix à l'unité).
export function uniteVenteAffichee(
  uniteVente: string | null | undefined,
  quantiteConditionnement: number | null | undefined,
): string | null {
  switch (uniteVente) {
    case "ramette":
      return "la ramette";
    case "paquet":
      return quantiteConditionnement ? `le paquet de ${quantiteConditionnement}` : "le paquet";
    case "lot":
      return quantiteConditionnement ? `le lot de ${quantiteConditionnement} feuilles` : "le lot";
    default:
      return null;
  }
}

// "2026-10-04" -> "4 octobre" (maj-accueil §7 : jamais "dimanche"/"samedi"/
// "week-end" côté client, seulement la date). `iso` = "YYYY-MM-DD".
export function formatDateLivraison(iso: string): string {
  const [annee, mois, jour] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(annee, mois - 1, jour, 12));
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "Africa/Dakar" });
}

// Coupe au dernier mot entier avant `max` caractères (title/description SEO :
// jamais un mot tranché en plein milieu).
export function tronquer(texte: string, max: number): string {
  if (texte.length <= max) return texte;
  const coupe = texte.slice(0, max);
  const dernierEspace = coupe.lastIndexOf(" ");
  return (dernierEspace > 0 ? coupe.slice(0, dernierEspace) : coupe).trimEnd();
}
