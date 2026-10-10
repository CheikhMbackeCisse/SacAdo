// Reconnaissance automatique d'un lieu spécial (TACHE_bug_checkout_ept.md) :
// soit par mot-clé tapé par le client ("EPT", "polytechnique de thies"…),
// soit parce que l'épingle posée tombe dans le rayon de couverture du lieu.
// Fonctions pures, testables sans Supabase — la lecture en base reste dans
// lib/checkout/actions.ts (resoudreLivraison).
import { distanceKm } from "../geo.ts";

const MARQUES_DIACRITIQUES = new RegExp("[\\u0300-\\u036f]", "g");

export function normaliserTexteLieu(s: string): string {
  return s
    .normalize("NFD")
    .replace(MARQUES_DIACRITIQUES, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type LieuSpecialGeo = {
  id: number;
  motsCles: string[];
  lat: number | null;
  lng: number | null;
  rayonM: number | null;
};

// Un mot-clé déclenche le lieu s'il est, une fois normalisé, égal au texte
// saisi (normalisé) ou inclus dedans — "je suis élève à l'EPT" doit matcher
// le mot-clé "ept" même entouré d'autre texte.
export function trouverLieuSpecialParTexte<T extends LieuSpecialGeo>(
  texte: string,
  lieux: T[],
): T | null {
  const requete = normaliserTexteLieu(texte);
  if (!requete) return null;
  for (const lieu of lieux) {
    for (const motCle of lieu.motsCles) {
      const normalise = normaliserTexteLieu(motCle);
      if (normalise && (requete === normalise || requete.includes(normalise))) {
        return lieu;
      }
    }
  }
  return null;
}

// Le point de livraison tombe dans le rayon de couverture d'un lieu spécial
// géolocalisé (ex: épingle posée sur l'EPT via recherche d'adresse ou GPS).
// Rend le plus proche en cas de rayons qui se chevauchent.
export function trouverLieuSpecialParPoint<T extends LieuSpecialGeo>(
  lat: number,
  lng: number,
  lieux: T[],
): T | null {
  let meilleur: T | null = null;
  let meilleureDistanceM = Infinity;
  for (const lieu of lieux) {
    if (lieu.lat == null || lieu.lng == null || lieu.rayonM == null) continue;
    const distanceM = distanceKm(lat, lng, lieu.lat, lieu.lng) * 1000;
    if (distanceM <= lieu.rayonM && distanceM < meilleureDistanceM) {
      meilleur = lieu;
      meilleureDistanceM = distanceM;
    }
  }
  return meilleur;
}
