// Régions administratives du Sénégal, avec un centre approximatif.
// Sert à déduire la région de livraison (donc le tarif) à partir de l'épingle
// posée sur la carte au checkout — la région n'est plus demandée au client.
// Les `nom` doivent correspondre EXACTEMENT aux `zones.nom` en base
// (voir supabase/migrations/0006_regions_senegal.sql).

export type RegionSenegal = { nom: string; lat: number; lng: number };

// Centres calés pour que les villes principales tombent dans la bonne région
// (vérifié sur Dakar, Thiès, Mbour, Touba, Diourbel, Kaolack, Fatick, Kaffrine,
// Louga, Saint-Louis, Matam, Tamba, Kédougou, Kolda, Sédhiou, Ziguinchor).
export const REGIONS_SENEGAL: RegionSenegal[] = [
  { nom: "Dakar", lat: 14.73, lng: -17.42 },
  { nom: "Thiès", lat: 14.8, lng: -16.85 },
  { nom: "Diourbel", lat: 14.7, lng: -16.25 },
  { nom: "Fatick", lat: 14.2, lng: -16.35 },
  { nom: "Kaolack", lat: 14.0, lng: -15.95 },
  { nom: "Kaffrine", lat: 14.05, lng: -15.45 },
  { nom: "Louga", lat: 15.5, lng: -15.4 },
  { nom: "Saint-Louis", lat: 16.3, lng: -15.6 },
  { nom: "Matam", lat: 15.4, lng: -13.4 },
  { nom: "Tambacounda", lat: 13.55, lng: -13.35 },
  { nom: "Kédougou", lat: 12.6, lng: -12.3 },
  { nom: "Kolda", lat: 12.9, lng: -14.75 },
  { nom: "Sédhiou", lat: 12.8, lng: -15.55 },
  { nom: "Ziguinchor", lat: 12.55, lng: -16.25 },
];

// Nom de la région dont le centre est le plus proche du point donné.
// Distance équirectangulaire (le facteur cos(lat) corrige l'étirement en
// longitude) — largement suffisant à l'échelle du Sénégal.
export function regionLaPlusProche(lat: number, lng: number): string {
  const cos = Math.cos((lat * Math.PI) / 180);
  let meilleure = REGIONS_SENEGAL[0];
  let meilleureDistance = Infinity;
  for (const region of REGIONS_SENEGAL) {
    const dLat = region.lat - lat;
    const dLng = (region.lng - lng) * cos;
    const distance = dLat * dLat + dLng * dLng;
    if (distance < meilleureDistance) {
      meilleureDistance = distance;
      meilleure = region;
    }
  }
  return meilleure.nom;
}
