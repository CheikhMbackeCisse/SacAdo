// Recherche d'adresse (geocoding) pour poser l'épingle de livraison au checkout.
// Types partagés client + serveur. La logique serveur vit dans
// app/api/geocoding/route.ts (proxy vers Nominatim + lieux connus).

export type ResultatLieu = {
  nom: string;
  lat: number;
  lng: number;
  // "connu" = repère saisi dans l'admin (/admin/lieux), prioritaire.
  // "osm" = résultat OpenStreetMap / Nominatim.
  source: "connu" | "osm";
};

export const MIN_CARACTERES_RECHERCHE = 3;

// Appelle notre proxy interne (jamais Nominatim directement depuis le client :
// on ne peut pas fixer le User-Agent et on veut fusionner les lieux connus).
export async function rechercherLieux(
  q: string,
  signal?: AbortSignal,
): Promise<ResultatLieu[]> {
  const requete = q.trim();
  if (requete.length < MIN_CARACTERES_RECHERCHE) return [];
  const res = await fetch(`/api/geocoding?q=${encodeURIComponent(requete)}`, { signal });
  if (!res.ok) return [];
  const data = (await res.json()) as { resultats?: ResultatLieu[] };
  return data.resultats ?? [];
}
