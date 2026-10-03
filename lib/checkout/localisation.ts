// Localisation du checkout (PROMPT_CLIENT_V2 Lot 2) : position GPS ou lien
// Google Maps collé par le client, à la place du champ libre « Comment
// trouver ta porte ». Fonctions pures, partagées client + serveur (pas de
// "use server" ici : lienGoogleMapsDepuisCoordonnees sert aussi côté client
// pour afficher "Voir sur la carte" sans aller-retour serveur).

export function coordonneesValides(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

// Lien à ouvrir en un toucher (admin, livreur, ou "Voir sur la carte" côté
// client) à partir d'une position GPS.
export function lienGoogleMapsDepuisCoordonnees(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

// Domaines Google Maps acceptés dans le champ "collez votre lien" — sert
// aussi de garde-fou avant de suivre une redirection côté serveur (jamais de
// fetch vers un domaine arbitraire).
const DOMAINES_GOOGLE_MAPS = new Set([
  "maps.app.goo.gl",
  "goo.gl",
  "google.com",
  "www.google.com",
  "maps.google.com",
]);

export function hostnameGoogleMaps(hostname: string): boolean {
  return DOMAINES_GOOGLE_MAPS.has(hostname.toLowerCase());
}

// "14.7167, -17.4677" (avec ou sans espace) -> coordonnées. Rejette tout ce
// qui n'est pas EXACTEMENT une paire lat,lng (pas de texte autour).
export function extraireCoordonneesDepuisTexte(texte: string): { lat: number; lng: number } | null {
  const m = texte.trim().match(/^(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  return coordonneesValides(lat, lng) ? { lat, lng } : null;
}

// Coordonnées embarquées dans une URL Google Maps déjà complète :
// .../@14.7167,-17.4677,15z ou ?q=14.7167,-17.4677 ou ?query=... ou ?ll=...
export function extraireCoordonneesDepuisUrl(url: URL): { lat: number; lng: number } | null {
  const arobase = url.href.match(/@(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/);
  if (arobase) {
    const lat = Number(arobase[1]);
    const lng = Number(arobase[2]);
    if (coordonneesValides(lat, lng)) return { lat, lng };
  }
  for (const cle of ["q", "query", "ll"]) {
    const valeur = url.searchParams.get(cle);
    if (!valeur) continue;
    const trouve = extraireCoordonneesDepuisTexte(valeur);
    if (trouve) return trouve;
  }
  return null;
}
