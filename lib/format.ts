export function formatPrice(amount: number): string {
  return `${Math.round(amount).toLocaleString("fr-FR")} FCFA`;
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
