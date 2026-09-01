"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, LocateFixed } from "lucide-react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";

export type Coordonnees = { lat: number; lng: number };

// Centre par défaut : Place de l'Indépendance, Dakar.
const DAKAR: Coordonnees = { lat: 14.6928, lng: -17.4467 };
const ZOOM_VILLE = 13;
const ZOOM_RUE = 17;

// Épingle SVG (bleu de marque) — un divIcon évite le bug classique des icônes
// PNG de Leaflet qui ne se résolvent pas avec un bundler.
const EPINGLE_HTML = `
<svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">
  <path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 13.4 23.9 14 24.5.6.6 1.4.6 2 0C16.6 38.9 30 25.5 30 15 30 6.7 23.3 0 15 0z" fill="#0B3D91"/>
  <circle cx="15" cy="15" r="6" fill="#FEFDFF"/>
</svg>`;

type Props = {
  position: Coordonnees | null;
  onChange: (position: Coordonnees) => void;
  // Lecture seule : l'épingle est figée (affichage d'une position déjà validée,
  // ex. fiche commande admin). Pas de drag, pas de clic, pas de bouton géoloc.
  readOnly?: boolean;
};

export function CartePin({ position, onChange, readOnly = false }: Props) {
  const conteneurRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  // Vrai quand la position vient d'un geste sur la carte (clic / drag) : dans ce
  // cas l'épingle est déjà bien placée, inutile de recadrer/zoomer la vue.
  const gesteInterne = useRef(false);
  // Figés pour l'init (l'effet a des deps vides et ne doit pas se relancer).
  const positionInitiale = useRef(position);
  const readOnlyRef = useRef(readOnly);

  const [pretePourInteraction, setPretePourInteraction] = useState(false);
  const [geoloc, setGeoloc] = useState<"idle" | "chargement" | "refus" | "indispo">("idle");

  // Initialisation de la carte : une seule fois, Leaflet importé côté client.
  useEffect(() => {
    let annule = false;
    let map: LeafletMap | null = null;

    void (async () => {
      const L = await import("leaflet");
      if (annule || !conteneurRef.current) return;

      const depart = positionInitiale.current ?? DAKAR;
      map = L.map(conteneurRef.current).setView(
        [depart.lat, depart.lng],
        positionInitiale.current ? ZOOM_RUE : ZOOM_VILLE,
      );
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap",
      }).addTo(map);

      const icone = L.divIcon({
        className: "",
        html: EPINGLE_HTML,
        iconSize: [30, 40],
        iconAnchor: [15, 40],
      });
      const modifiable = !readOnlyRef.current;
      const marker = L.marker([depart.lat, depart.lng], {
        draggable: modifiable,
        autoPan: modifiable,
        icon: icone,
      }).addTo(map);

      if (modifiable) {
        marker.on("dragend", () => {
          const { lat, lng } = marker.getLatLng();
          gesteInterne.current = true;
          onChangeRef.current({ lat, lng });
        });
        map.on("click", (event) => {
          marker.setLatLng(event.latlng);
          gesteInterne.current = true;
          onChangeRef.current({ lat: event.latlng.lat, lng: event.latlng.lng });
        });
      }

      mapRef.current = map;
      markerRef.current = marker;
      // Le conteneur peut être mesuré à 0 au premier rendu (onglet, transition).
      setTimeout(() => {
        map?.invalidateSize();
        if (!annule) setPretePourInteraction(true);
      }, 0);
    })();

    return () => {
      annule = true;
      map?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Position modifiée depuis l'extérieur (pré-remplissage, bouton « Ma position »)
  // → recadrer. Geste sur la carte → l'épingle est déjà en place, on ne bouge pas.
  useEffect(() => {
    if (!position || !markerRef.current || !mapRef.current) return;
    markerRef.current.setLatLng([position.lat, position.lng]);
    if (gesteInterne.current) {
      gesteInterne.current = false;
      return;
    }
    mapRef.current.setView([position.lat, position.lng], ZOOM_RUE);
  }, [position]);

  const localiser = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoloc("indispo");
      return;
    }
    setGeoloc("chargement");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoloc("idle");
        onChangeRef.current({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => setGeoloc("refus"),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={conteneurRef}
        className="relative z-0 h-56 w-full overflow-hidden rounded-xl border border-ink/15 bg-ink/5"
        role="application"
        aria-label="Carte de localisation de la livraison"
      >
        {!pretePourInteraction && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-ink/40">
            Chargement de la carte…
          </span>
        )}
      </div>

      {!readOnly && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={localiser}
              disabled={geoloc === "chargement"}
              className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/70 transition-transform active:scale-95 disabled:opacity-50"
            >
              {geoloc === "chargement" ? (
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              ) : (
                <LocateFixed size={14} aria-hidden="true" />
              )}
              {geoloc === "chargement" ? "Localisation…" : "Utiliser ma position"}
            </button>
            <span className="text-[11px] text-ink/50">
              {position
                ? "Déplace l’épingle jusqu’à ta porte."
                : "Place l’épingle sur la carte, ou utilise ta position."}
            </span>
          </div>

          {geoloc === "refus" && (
            <p className="text-[11px] text-ink/60">
              Localisation refusée. Place l’épingle à la main sur la carte, c’est suffisant.
            </p>
          )}
          {geoloc === "indispo" && (
            <p className="text-[11px] text-ink/60">
              La localisation n’est pas disponible sur cet appareil. Place l’épingle à la main.
            </p>
          )}
        </>
      )}
    </div>
  );
}
