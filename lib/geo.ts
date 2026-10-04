// Fonctions géographiques pures, partagées admin + checkout (PROMPT_CLIENT_
// LOCALISATION.md Lot 2) : distance entre deux points, et test d'appartenance
// à une zone dessinée. Pas besoin de turf.js pour ces deux calculs simples.

export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Ray casting classique. `polygone` = [[lng, lat], …] (convention GeoJSON),
// comme stocké dans localites.zone_polygone.
export function pointDansPolygone(lat: number, lng: number, polygone: [number, number][]): boolean {
  let dedans = false;
  for (let i = 0, j = polygone.length - 1; i < polygone.length; j = i++) {
    const [lngI, latI] = polygone[i];
    const [lngJ, latJ] = polygone[j];
    const intersecte =
      latI > lat !== latJ > lat && lng < ((lngJ - lngI) * (lat - latI)) / (latJ - latI) + lngI;
    if (intersecte) dedans = !dedans;
  }
  return dedans;
}
