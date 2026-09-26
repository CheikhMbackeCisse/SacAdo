// Accueil "rentrée d'abord" + variété (maj-26-09 §7). Post-traitement PUR sur
// la liste déjà classée par `accueil_classement` + `assemblerAccueil` : ne
// remplace pas ce classement, le réordonne par petits groupes.
//
// Effet de bord assumé : un produit épinglé par l'admin (epingle_position)
// peut glisser de sa case exacte si la priorité rentrée ou la règle de
// variété le déplace — l'algorithme ne connaît plus l'origine ("epingle" vs
// "score") à ce stade. Compromis documenté dans le rapport du chantier.

export type ProduitDiversite = {
  id: number;
  prix: number;
  categorie_id: number | null;
  sous_categorie_id: number | null;
  marque: string | null;
  editeur: string | null;
};

// Poids de priorité "rentrée d'abord" : kits, fournitures, cahiers, livres en
// tête (dans cet ordre) ; informatique en dernier, le reste entre les deux
// dans son ordre de classement d'origine.
const CATEGORIE_KITS = 1;
const CATEGORIE_CAHIERS = 2;
const CATEGORIE_LIVRES = 6;
const CATEGORIE_INFORMATIQUE = 7;
const CATEGORIE_FOURNITURES = 11;

function poidsCategorie(categorieId: number | null): number {
  switch (categorieId) {
    case CATEGORIE_KITS:
      return 0;
    case CATEGORIE_FOURNITURES:
      return 1;
    case CATEGORIE_CAHIERS:
      return 2;
    case CATEGORIE_LIVRES:
      return 3;
    case CATEGORIE_INFORMATIQUE:
      return 5;
    default:
      return 4;
  }
}

// Ne dépasse jamais 30 % d'une section pour un même éditeur ou une même
// marque, et jamais plus de 2 produits consécutifs du même éditeur, de la
// même marque ou de la même sous-catégorie.
export function appliquerDiversite<T extends ProduitDiversite>(produits: T[]): T[] {
  if (produits.length <= 2) return produits;

  const plafond = Math.max(1, Math.ceil(produits.length * 0.3));
  const compteEditeur = new Map<string, number>();
  const compteMarque = new Map<string, number>();

  const resultat: T[] = [];
  const reportes: T[] = [];

  const violeRegleConsecutive = (p: T): boolean => {
    const deux = resultat.slice(-2);
    if (deux.length < 2) return false;
    const [a, b] = deux;
    if (p.editeur && a.editeur === p.editeur && b.editeur === p.editeur) return true;
    if (p.marque && a.marque === p.marque && b.marque === p.marque) return true;
    if (
      p.sous_categorie_id != null &&
      a.sous_categorie_id === p.sous_categorie_id &&
      b.sous_categorie_id === p.sous_categorie_id
    ) {
      return true;
    }
    return false;
  };

  const depassePlafond = (p: T): boolean => {
    if (p.editeur && (compteEditeur.get(p.editeur) ?? 0) >= plafond) return true;
    if (p.marque && (compteMarque.get(p.marque) ?? 0) >= plafond) return true;
    return false;
  };

  const placer = (p: T) => {
    resultat.push(p);
    if (p.editeur) compteEditeur.set(p.editeur, (compteEditeur.get(p.editeur) ?? 0) + 1);
    if (p.marque) compteMarque.set(p.marque, (compteMarque.get(p.marque) ?? 0) + 1);
  };

  for (const p of produits) {
    if (depassePlafond(p) || violeRegleConsecutive(p)) {
      reportes.push(p);
      continue;
    }
    placer(p);
  }

  // Les reportés (plafond ou clustering) sont réinsérés à la fin, dans leur
  // ordre d'origine — mieux vaut les montrer quand même que les faire
  // disparaître, la contrainte est une préférence de présentation, pas un filtre.
  for (const p of reportes) placer(p);

  return resultat;
}

// Regroupe par priorité "rentrée d'abord" (kits/fournitures/cahiers/livres en
// tête, informatique en dernier trié du moins cher au plus cher), applique la
// variété À L'INTÉRIEUR de chaque groupe (pour ne jamais faire remonter
// l'informatique au-dessus des groupes prioritaires), puis reconcatène.
export function ordonnerAccueil<T extends ProduitDiversite>(produits: T[]): T[] {
  const groupes = new Map<number, T[]>();
  for (const p of produits) {
    const poids = poidsCategorie(p.categorie_id);
    if (!groupes.has(poids)) groupes.set(poids, []);
    groupes.get(poids)!.push(p);
  }

  const informatique = groupes.get(5);
  if (informatique) informatique.sort((a, b) => a.prix - b.prix);

  return [...groupes.keys()]
    .sort((a, b) => a - b)
    .flatMap((poids) => appliquerDiversite(groupes.get(poids)!));
}
