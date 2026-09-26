// Marques avec logo (maj-26-09 §4) : seules ces 4 ont un logo au catalogue.
// Toute autre marque n'affiche que son nom en texte — jamais le logo d'une
// marque voisine (ex. Calligraphe n'a pas le logo Clairefontaine).
const LOGOS_MARQUES: Record<string, string> = {
  Maped: "/images/marques/maped.webp",
  Giotto: "/images/marques/giotto.webp",
  Schneider: "/images/marques/schneider.webp",
  Clairefontaine: "/images/marques/clairefontaine.webp",
};

export function logoMarque(marque: string | null | undefined): string | null {
  if (!marque) return null;
  return LOGOS_MARQUES[marque] ?? null;
}
