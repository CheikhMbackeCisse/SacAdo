export function formatPrice(amount: number): string {
  return `${Math.round(amount).toLocaleString("fr-FR")} FCFA`;
}

// Coupe au dernier mot entier avant `max` caractères (title/description SEO :
// jamais un mot tranché en plein milieu).
export function tronquer(texte: string, max: number): string {
  if (texte.length <= max) return texte;
  const coupe = texte.slice(0, max);
  const dernierEspace = coupe.lastIndexOf(" ");
  return (dernierEspace > 0 ? coupe.slice(0, dernierEspace) : coupe).trimEnd();
}
