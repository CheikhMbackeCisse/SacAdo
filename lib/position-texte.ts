import type { Coordonnees } from "@/components/checkout/carte-pin";

// Reconnaît une position collée directement (sans passer par Nominatim) :
// un lien Google Maps, une paire de coordonnées décimales, ou un Open
// Location Code ("plus code") complet — PROMPT_PARTAGE_MOBILIER_FOURNISSEURS
// Lot 4. Un plus code COURT (ex. "PH34+26 Dakar", sans le préfixe de zone)
// n'est pas décodable sans géocoder la localité : on laisse ce cas remonter
// vers la recherche d'adresse habituelle (Nominatim), qui s'en sort en
// général correctement sur ce genre de texte libre.

const ALPHABET_PLUS_CODE = "23456789CFGHJMPQRVWX";
const RESOLUTIONS_PAIRE = [20, 1, 0.05, 0.0025, 0.000125];

function dansLesBornes(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

// Décode un Open Location Code complet (8 caractères significatifs minimum
// avant le "+", ex. "7C64MHC7+M6") — ignore le raffinement de grille au-delà
// du 10e caractère, largement assez précis pour un point de retrait.
function decoderPlusCodeComplet(brut: string): Coordonnees | null {
  const code = brut.trim().toUpperCase().replace(/\s+/g, "");
  const i = code.indexOf("+");
  if (i < 8) return null;
  const chiffres = (code.slice(0, i) + code.slice(i + 1)).slice(0, 10);
  if (chiffres.length < 10) return null;
  for (const c of chiffres) if (!ALPHABET_PLUS_CODE.includes(c)) return null;

  let lat = -90;
  let lng = -180;
  for (let p = 0; p < 5; p++) {
    const chiffreLat = ALPHABET_PLUS_CODE.indexOf(chiffres[p * 2]);
    const chiffreLng = ALPHABET_PLUS_CODE.indexOf(chiffres[p * 2 + 1]);
    lat += chiffreLat * RESOLUTIONS_PAIRE[p];
    lng += chiffreLng * RESOLUTIONS_PAIRE[p];
  }
  const derniereResolution = RESOLUTIONS_PAIRE[4];
  lat += derniereResolution / 2;
  lng += derniereResolution / 2;
  return dansLesBornes(lat, lng) ? { lat, lng } : null;
}

// Liens Google Maps usuels : "/@lat,lng,17z", "?q=lat,lng", ou les URL de
// fiche lieu qui encodent la position dans "!3dlat!4dlng".
function depuisLienGoogleMaps(texte: string): Coordonnees | null {
  const motifs = [/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, /[@?&]q?=?(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/];
  for (const motif of motifs) {
    const m = texte.match(motif);
    if (!m) continue;
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (dansLesBornes(lat, lng)) return { lat, lng };
  }
  return null;
}

function depuisPaireDecimale(texte: string): Coordonnees | null {
  const m = texte.trim().match(/^(-?\d{1,2}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  return dansLesBornes(lat, lng) ? { lat, lng } : null;
}

export function positionDepuisTexte(texte: string): Coordonnees | null {
  const q = texte.trim();
  if (!q) return null;
  return depuisPaireDecimale(q) ?? depuisLienGoogleMaps(q) ?? decoderPlusCodeComplet(q);
}
