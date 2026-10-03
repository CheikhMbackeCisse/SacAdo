"use server";

import {
  extraireCoordonneesDepuisTexte,
  extraireCoordonneesDepuisUrl,
  hostnameGoogleMaps,
} from "@/lib/checkout/localisation";

export type ResolutionLocalisation =
  | { ok: true; lat: number | null; lng: number | null; lien: string }
  | { ok: false; error: string };

const DELAI_RESOLUTION_MS = 5000;

// Résout ce que le client a collé dans "Localisation" (PROMPT_CLIENT_V2
// Lot 2) : coordonnées brutes, lien Google Maps complet (coordonnées déjà
// dans l'URL), ou lien court (maps.app.goo.gl, goo.gl/maps) qu'il faut
// suivre pour trouver l'URL finale. Le lien STOCKÉ est toujours la saisie
// d'origine (plus court, plus naturel à rouvrir) — seules les coordonnées
// sont extraites pour l'affichage carte interne.
//
// Un lien Google Maps reconnu est toujours accepté même si la résolution
// réseau échoue (redirection indisponible) : on perd juste l'aperçu carte,
// jamais la commande — même philosophie que la localité en texte libre
// (resoudreLivraison, lib/checkout/actions.ts).
export async function resoudreLienLocalisation(saisie: string): Promise<ResolutionLocalisation> {
  const texte = saisie.trim();
  if (!texte) return { ok: false, error: "Indique ta position (position actuelle ou lien Google Maps)." };
  if (texte.length > 500) return { ok: false, error: "Lien trop long." };

  const direct = extraireCoordonneesDepuisTexte(texte);
  if (direct) return { ok: true, lat: direct.lat, lng: direct.lng, lien: texte };

  let url: URL;
  try {
    url = new URL(texte);
  } catch {
    return {
      ok: false,
      error: "Lien ou coordonnées non reconnus. Colle un lien Google Maps ou des coordonnées (14.7167, -17.4677).",
    };
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, error: "Seuls les liens Google Maps sont acceptés." };
  }
  if (!hostnameGoogleMaps(url.hostname)) {
    return { ok: false, error: "Seuls les liens Google Maps sont acceptés." };
  }

  const depuisUrl = extraireCoordonneesDepuisUrl(url);
  if (depuisUrl) return { ok: true, lat: depuisUrl.lat, lng: depuisUrl.lng, lien: texte };

  // Lien court : les coordonnées ne sont pas dans l'URL, seulement dans la
  // page de destination après redirection. Best-effort, borné dans le temps.
  try {
    const reponse = await fetch(url.toString(), {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(DELAI_RESOLUTION_MS),
    });
    const finale = new URL(reponse.url);
    const trouve = extraireCoordonneesDepuisUrl(finale);
    if (trouve) return { ok: true, lat: trouve.lat, lng: trouve.lng, lien: texte };
  } catch {
    // Redirection indisponible : on garde quand même le lien (ci-dessous).
  }

  return { ok: true, lat: null, lng: null, lien: texte };
}
