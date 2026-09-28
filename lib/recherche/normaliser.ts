const MARQUES_DIACRITIQUES = new RegExp("[\\u0300-\\u036f]", "g");
// ᵉ (U+1D49) et ʳ (U+02B3) sont des LETTRES MODIFICATIVES à part entière, pas
// des accents combinables : le NFD + strip ci-dessus ne les touche pas. Sans
// cette correction explicite, "3ᵉ", "Tlᵉ" ou "1ʳᵉ" (noms de produits réels)
// ne matchent jamais "3e"/"tle"/"1re" (CORRECTIONS_V11 lot 4 §2).
const EXPOSANT_E = /ᵉ/g;
const EXPOSANT_R = /ʳ/g;
// "C.M.2" -> "cm2" après suppression des points ; "CM 2" (espace, pas de
// point) a besoin de cette fusion dédiée pour devenir "cm2" à son tour.
const NIVEAU_ESPACE_CHIFFRE = /\b(ci|cp|ce|cm)\s+(\d)/g;

// Même normalisation que `public.normaliser_recherche(...)` côté Postgres
// (migration 0094, qui remplace l'ancien `unaccent_immutable(lower(...))` de
// la migration 0041) : minuscules, sans accents, formes de niveau uniformes,
// espaces multiples réduits. Les termes de `synonymes` et ceux du journal des
// recherches vides sont stockés sous cette forme ; sinon un synonyme saisi
// « Clé USB » ne matcherait jamais l'index, et le regroupement par fréquence
// compterait « Bic » et « bic » à part.
export function normaliserTerme(brut: string): string {
  return brut
    .normalize("NFD")
    .replace(MARQUES_DIACRITIQUES, "")
    .toLowerCase()
    .replace(EXPOSANT_E, "e")
    .replace(EXPOSANT_R, "r")
    .replace(/\./g, "")
    .replace(NIVEAU_ESPACE_CHIFFRE, "$1$2")
    .replace(/\s+/g, " ")
    .trim();
}
