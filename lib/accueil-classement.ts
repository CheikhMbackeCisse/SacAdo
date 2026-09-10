// Assemblage du flux d'accueil (TACHE_algorithme_classement.md §4), pur et
// testable. Le tri, les exclusions et le quota 3/sous-catégorie sont déjà faits
// en base par `accueil_classement()` ; ici : réservation des places
// d'exploration et placement des épinglages.

export type OrigineProduit = "score" | "exploration" | "epingle";

export type LigneAccueil = {
  produit_id: number;
  sous_categorie_id: number | null;
  // score_final = score_global × (1 + facteur × affinité) — déjà calculé et
  // trié par la RPC `accueil_classement`. L'assemblage ne s'en sert pas
  // (il respecte l'ordre reçu) mais le garde pour le débogage.
  score_final: number;
  epingle_position: number | null;
  exploration_eligible: boolean;
};

// Places réservées à l'exploration dans les 20 premiers (§4.2).
export const N_EXPLORATION_ACCUEIL = 4;

function melanger<T>(liste: T[], alea: () => number): T[] {
  const copie = [...liste];
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(alea() * (i + 1));
    [copie[i], copie[j]] = [copie[j], copie[i]];
  }
  return copie;
}

export type PlaceAccueil = { produitId: number; origine: OrigineProduit };

// `lignes` est supposé trié par score_global décroissant (ordre de la RPC).
export function assemblerAccueil(
  lignes: LigneAccueil[],
  limit: number,
  alea: () => number = Math.random,
): PlaceAccueil[] {
  if (limit <= 0 || lignes.length === 0) return [];

  type Case = { produitId: number; origine: OrigineProduit } | null;
  const cases: Case[] = Array.from({ length: limit }, () => null);
  const utilises = new Set<number>();

  // 1. Épinglés : à leur position (1-based), sinon poussés à la case libre suivante.
  const epingles = lignes
    .filter((l) => l.epingle_position != null)
    .sort((a, b) => (a.epingle_position ?? 0) - (b.epingle_position ?? 0));
  for (const l of epingles) {
    if (utilises.has(l.produit_id)) continue;
    let idx = Math.min(Math.max((l.epingle_position ?? 1) - 1, 0), limit - 1);
    while (idx < limit && cases[idx] !== null) idx++;
    if (idx >= limit) continue;
    cases[idx] = { produitId: l.produit_id, origine: "epingle" };
    utilises.add(l.produit_id);
  }

  // 2. Pools non épinglés.
  const pool = lignes.filter(
    (l) => l.epingle_position == null && !utilises.has(l.produit_id),
  );
  const exploration = melanger(
    pool.filter((l) => l.exploration_eligible),
    alea,
  ).slice(0, N_EXPLORATION_ACCUEIL);
  const explorationIds = new Set(exploration.map((l) => l.produit_id));
  const parScore = pool.filter((l) => !explorationIds.has(l.produit_id));

  // 3. Cases libres + placement régulier des places d'exploration.
  const libres: number[] = [];
  for (let i = 0; i < limit; i++) if (cases[i] === null) libres.push(i);

  const nbExpl = Math.min(exploration.length, libres.length);
  const casesExpl = new Set<number>();
  if (nbExpl > 0) {
    const pas = libres.length / nbExpl;
    for (let k = 0; k < nbExpl; k++) {
      casesExpl.add(libres[Math.min(Math.floor(k * pas + pas / 2), libres.length - 1)]);
    }
  }

  // 4. Remplissage.
  let iExpl = 0;
  let iScore = 0;
  for (const idx of libres) {
    if (casesExpl.has(idx) && iExpl < exploration.length) {
      cases[idx] = { produitId: exploration[iExpl++].produit_id, origine: "exploration" };
    } else if (iScore < parScore.length) {
      cases[idx] = { produitId: parScore[iScore++].produit_id, origine: "score" };
    }
  }
  // Cases d'exploration non pourvues (trop peu d'éligibles) -> repli score.
  for (const idx of libres) {
    if (cases[idx] === null && iScore < parScore.length) {
      cases[idx] = { produitId: parScore[iScore++].produit_id, origine: "score" };
    }
  }

  return cases.filter((c): c is PlaceAccueil => c !== null);
}
