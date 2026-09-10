const MARQUES_DIACRITIQUES = new RegExp("[\\u0300-\\u036f]", "g");

// Même normalisation que `public.unaccent_immutable(lower(...))` côté Postgres
// (migration 0041) : minuscules, sans accents, espaces multiples réduits.
// Les termes de `synonymes` et ceux du journal des recherches vides sont stockés
// sous cette forme ; sinon un synonyme saisi « Clé USB » ne matcherait jamais
// l'index, et le regroupement par fréquence compterait « Bic » et « bic » à part.
export function normaliserTerme(brut: string): string {
  return brut
    .normalize("NFD")
    .replace(MARQUES_DIACRITIQUES, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
