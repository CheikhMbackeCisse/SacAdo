"use client";

import { ExternalLink } from "lucide-react";
import { CartePin } from "@/components/checkout/carte-pin";

// Affiche le point de livraison d'une commande (fiche admin, suivi client).
// Carte en lecture seule + précision livreur + liens vers une app de navigation.
export function CommandeLocalisation({
  lat,
  lng,
  precision,
  liensNavigation = false,
}: {
  lat: number;
  lng: number;
  precision: string | null;
  liensNavigation?: boolean;
}) {
  const google = `https://www.google.com/maps?q=${lat},${lng}`;
  const osm = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`;

  return (
    <div className="flex flex-col gap-2">
      <CartePin position={{ lat, lng }} onChange={() => {}} readOnly />

      {precision && (
        <p className="text-sm text-ink/70">
          <span className="font-semibold text-ink">Précision livreur : </span>
          {precision}
        </p>
      )}

      {liensNavigation && (
        <div className="flex flex-wrap gap-2">
          <a
            href={google}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/70 transition-transform active:scale-95"
          >
            <ExternalLink size={13} aria-hidden="true" />
            Google Maps
          </a>
          <a
            href={osm}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/70 transition-transform active:scale-95"
          >
            <ExternalLink size={13} aria-hidden="true" />
            OpenStreetMap
          </a>
        </div>
      )}
    </div>
  );
}
