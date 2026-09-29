// Retarde la fenêtre d'installation Android pour un visiteur venu d'une
// publicité/campagne (Google Ads en préparation) : jamais sur la 1re page vue
// de la session, au plus tôt à partir de la 2e. La détection du paramètre est
// pure et testable ; la persistance (sessionStorage) est isolée dans de
// petites fonctions à effet de bord.

const PARAMETRES_PUB = ["gclid", "gbraid", "wbraid", "utm_source"];

const CLE_VISITE_PUB = "sacado_session_pub";
const CLE_COMPTEUR_PAGES = "sacado_session_pages";
const CLE_DERNIER_PATHNAME = "sacado_session_pages_pathname";

export function contientParametrePub(search: string): boolean {
  const params = new URLSearchParams(search);
  return PARAMETRES_PUB.some((p) => params.has(p));
}

// À appeler à chaque page vue (l'URL peut avoir perdu ses paramètres après une
// navigation cliente) : une fois la session marquée "pub", elle le reste.
export function marquerVisitePub(search: string): void {
  try {
    if (window.sessionStorage.getItem(CLE_VISITE_PUB) === "1") return;
    if (contientParametrePub(search)) {
      window.sessionStorage.setItem(CLE_VISITE_PUB, "1");
    }
  } catch {
    // sessionStorage indisponible : pas de retard appliqué, tant pis
  }
}

export function estVisitePub(): boolean {
  try {
    return window.sessionStorage.getItem(CLE_VISITE_PUB) === "1";
  } catch {
    return false;
  }
}

// Incrémente le compteur de pages vues au plus une fois par pathname (un
// second rendu du même pathname — re-render, Strict Mode, retour en arrière
// sur la même page — ne recompte pas). Retourne le total à jour.
export function compterPageVue(pathname: string): number {
  try {
    const dernier = window.sessionStorage.getItem(CLE_DERNIER_PATHNAME);
    const actuel = Number(window.sessionStorage.getItem(CLE_COMPTEUR_PAGES) || "0");
    if (dernier === pathname) return actuel || 1;
    const total = actuel + 1;
    window.sessionStorage.setItem(CLE_DERNIER_PATHNAME, pathname);
    window.sessionStorage.setItem(CLE_COMPTEUR_PAGES, String(total));
    return total;
  } catch {
    return 1;
  }
}
