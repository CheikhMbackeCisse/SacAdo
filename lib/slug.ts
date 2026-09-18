// Slug d'URL produit (TACHE_migration_sacado_sn_et_seo.md, partie 2.3) :
// décoratif seulement, l'id final fait foi. Aucune migration, aucune colonne
// : recalculé à la volée depuis le nom à chaque affichage/lien.

const LONGUEUR_MAX = 60;
const MARQUES_DIACRITIQUES = /[̀-ͯ]/g;

export function slugify(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(MARQUES_DIACRITIQUES, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, LONGUEUR_MAX)
    .replace(/-$/, "");
}

export function slugAvecId(nom: string, id: number): string {
  const slug = slugify(nom);
  return slug ? `${slug}-${id}` : String(id);
}

// Accepte aussi bien "1042" (vieux lien numérique) que
// "cahier-96-pages-oxford-1042" : seul le nombre final compte.
export function idDepuisSlug(param: string): number | null {
  const trouve = param.match(/(\d+)$/);
  if (!trouve) return null;
  const id = Number(trouve[1]);
  return Number.isFinite(id) ? id : null;
}
