"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, LocateFixed } from "lucide-react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

export type Coordonnees = { lat: number; lng: number };

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// Centre par défaut : Place de l'Indépendance, Dakar.
const DAKAR: Coordonnees = { lat: 14.6928, lng: -17.4467 };
const ZOOM_VILLE = 12;
const ZOOM_RUE = 16;

const STYLE_CLAIR = "mapbox://styles/mapbox/streets-v12";
const STYLE_SOMBRE = "mapbox://styles/mapbox/dark-v11";
const BLEU_MARQUE = "#0B3D91";

// Style selon le thème de l'app (attribut data-theme posé avant le paint) ou,
// à défaut, la préférence système.
function styleSelonTheme(): string {
  if (typeof document === "undefined") return STYLE_CLAIR;
  const t = document.documentElement.dataset.theme;
  if (t === "dark") return STYLE_SOMBRE;
  if (t === "light") return STYLE_CLAIR;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? STYLE_SOMBRE : STYLE_CLAIR;
}

type Props = {
  position: Coordonnees | null;
  onChange: (position: Coordonnees) => void;
  // Lecture seule : épingle figée (fiche commande admin, suivi client).
  readOnly?: boolean;
};

export function CartePin({ position, onChange, readOnly = false }: Props) {
  const conteneurRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  const gesteInterne = useRef(false);
  const positionInitiale = useRef(position);
  const readOnlyRef = useRef(readOnly);

  const [pretePourInteraction, setPretePourInteraction] = useState(false);
  const [geoloc, setGeoloc] = useState<"idle" | "chargement" | "refus" | "indispo">("idle");

  // Initialisation de la carte, une seule fois.
  useEffect(() => {
    if (!TOKEN || !conteneurRef.current) return;
    let annule = false;
    mapboxgl.accessToken = TOKEN;

    const depart = positionInitiale.current ?? DAKAR;
    const modifiable = !readOnlyRef.current;
    const map = new mapboxgl.Map({
      container: conteneurRef.current,
      style: styleSelonTheme(),
      center: [depart.lng, depart.lat],
      zoom: positionInitiale.current ? ZOOM_RUE : ZOOM_VILLE,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-left");

    const marker = new mapboxgl.Marker({ color: BLEU_MARQUE, draggable: modifiable })
      .setLngLat([depart.lng, depart.lat])
      .addTo(map);

    if (modifiable) {
      marker.on("dragend", () => {
        const { lat, lng } = marker.getLngLat();
        gesteInterne.current = true;
        onChangeRef.current({ lat, lng });
      });
      map.on("click", (event) => {
        marker.setLngLat(event.lngLat);
        gesteInterne.current = true;
        onChangeRef.current({ lat: event.lngLat.lat, lng: event.lngLat.lng });
      });
    }

    map.on("load", () => {
      map.resize();
      if (!annule) setPretePourInteraction(true);
    });

    mapRef.current = map;
    markerRef.current = marker;

    return () => {
      annule = true;
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Position modifiée depuis l'extérieur (géoloc, pré-remplissage) → recadrer.
  useEffect(() => {
    if (!position || !markerRef.current || !mapRef.current) return;
    markerRef.current.setLngLat([position.lng, position.lat]);
    if (gesteInterne.current) {
      gesteInterne.current = false;
      return;
    }
    mapRef.current.flyTo({ center: [position.lng, position.lat], zoom: ZOOM_RUE });
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
        {!TOKEN && (
          <span className="absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-ink/50">
            {readOnly
              ? "Carte momentanément indisponible."
              : "Carte momentanément indisponible. Utilise « Ma position » ci-dessous."}
          </span>
        )}
        {TOKEN && !pretePourInteraction && (
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
                ? "Ajuste l’épingle jusqu’à ta porte, sur la route accessible la plus proche."
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
