// Marques avec logo (maj-26-09 §4, Eastpak ajoutée PROMPT_FINAL_CATALOGUE_KITS lot 5) :
// seules celles listées ci-dessous ont un logo au catalogue.
// Toute autre marque n'affiche que son nom en texte — jamais le logo d'une
// marque voisine (ex. Calligraphe n'a pas le logo Clairefontaine).
const LOGOS_MARQUES: Record<string, string> = {
  Maped: "/images/marques/maped.webp",
  Giotto: "/images/marques/giotto.webp",
  Schneider: "/images/marques/schneider.webp",
  Clairefontaine: "/images/marques/clairefontaine.webp",
  Eastpak: "/images/marques/eastpak.webp",
};

export function logoMarque(marque: string | null | undefined): string | null {
  if (!marque) return null;
  return LOGOS_MARQUES[marque] ?? null;
}
