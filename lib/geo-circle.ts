// Approxime un cercle géographique (centre + rayon en km) par un polygone de
// points [lng, lat], pour prévisualiser le rayon de couverture d'une localité
// sur la carte (PROMPT_ADMIN_COMPTA_LOCALITES.md Lot 2 §3). Pas besoin de
// turf.js pour ça : à l'échelle d'un rayon de quelques km, l'approximation
// plane (conversion degrés <-> km) est largement suffisante.
const KM_PAR_DEGRE_LAT = 111.32;

export function cercleGeoJSON(
  centreLat: number,
  centreLng: number,
  rayonKm: number,
  nbPoints = 64,
): [number, number][] {
  const kmParDegreLng = KM_PAR_DEGRE_LAT * Math.cos((centreLat * Math.PI) / 180);
  const points: [number, number][] = [];
  for (let i = 0; i <= nbPoints; i++) {
    const angle = (2 * Math.PI * i) / nbPoints;
    const dLat = (rayonKm * Math.sin(angle)) / KM_PAR_DEGRE_LAT;
    const dLng = (rayonKm * Math.cos(angle)) / kmParDegreLng;
    points.push([centreLng + dLng, centreLat + dLat]);
  }
  return points;
}
