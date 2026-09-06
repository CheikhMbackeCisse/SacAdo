"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, LocateFixed, MapPin, Search } from "lucide-react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  MIN_CARACTERES_RECHERCHE,
  rechercherLieux,
  type ResultatLieu,
} from "@/lib/geocoding";

export type Coordonnees = { lat: number; lng: number };

// MapLibre v6 charge son web worker depuis un fichier séparé. Turbopack ne
// ré-émet pas le module partagé à côté du worker hashé → le worker plante et
// aucune tuile ne se charge. On pointe donc vers la copie statique de
// public/vendor/maplibre/ (générée par scripts/copier-worker-maplibre.mjs).
maplibregl.setWorkerUrl("/vendor/maplibre/maplibre-gl-worker.mjs");

// Centre par défaut : Place de l'Indépendance, Dakar.
const DAKAR: Coordonnees = { lat: 14.6928, lng: -17.4467 };
const ZOOM_VILLE = 12;
const ZOOM_RUE = 16;

// Fonds de carte OpenFreeMap : gratuits, sans compte ni clé, sans carte
// bancaire (projet communautaire, tuiles + polices + sprites servis depuis
// tiles.openfreemap.org).
const STYLE_CLAIR = "https://tiles.openfreemap.org/styles/liberty";
const STYLE_SOMBRE = "https://tiles.openfreemap.org/styles/dark";
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
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  const gesteInterne = useRef(false);
  const positionInitiale = useRef(position);
  const readOnlyRef = useRef(readOnly);

  const [pretePourInteraction, setPretePourInteraction] = useState(false);
  const [carteHs, setCarteHs] = useState(false);
  const [geoloc, setGeoloc] = useState<"idle" | "chargement" | "refus" | "indispo">("idle");

  // Recherche d'adresse (geocoding) : taper un lieu → la carte s'y rend.
  const [recherche, setRecherche] = useState("");
  const [resultats, setResultats] = useState<ResultatLieu[]>([]);
  const [rechercheEnCours, setRechercheEnCours] = useState(false);
  const [listeOuverte, setListeOuverte] = useState(false);
  // Évite de relancer une recherche quand on remplit le champ avec le résultat choisi.
  const ignorerRecherche = useRef(false);

  // Initialisation de la carte, une seule fois.
  useEffect(() => {
    if (!conteneurRef.current) return;
    let annule = false;

    const depart = positionInitiale.current ?? DAKAR;
    const modifiable = !readOnlyRef.current;
    const map = new maplibregl.Map({
      container: conteneurRef.current,
      style: styleSelonTheme(),
      center: [depart.lng, depart.lat],
      zoom: positionInitiale.current ? ZOOM_RUE : ZOOM_VILLE,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");

    const marker = new maplibregl.Marker({ color: BLEU_MARQUE, draggable: modifiable })
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
    // Fond de carte injoignable (OpenFreeMap sans SLA) : on bascule sur le
    // repli « placer l'épingle à la main » plutôt qu'une carte cassée.
    map.on("error", (event) => {
      const status = (event.error as unknown as { status?: number })?.status;
      if (status && status >= 400 && !annule) setCarteHs(true);
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

  const majRecherche = (valeur: string) => {
    setRecherche(valeur);
    if (valeur.trim().length < MIN_CARACTERES_RECHERCHE) {
      setResultats([]);
      setListeOuverte(false);
    }
  };

  // Recherche différée (400 ms) à chaque frappe.
  useEffect(() => {
    if (readOnly) return;
    if (ignorerRecherche.current) {
      ignorerRecherche.current = false;
      return;
    }
    const q = recherche.trim();
    if (q.length < MIN_CARACTERES_RECHERCHE) return;

    const controleur = new AbortController();
    const minuteur = setTimeout(async () => {
      setRechercheEnCours(true);
      try {
        const trouves = await rechercherLieux(q, controleur.signal);
        setResultats(trouves);
        setListeOuverte(true);
      } catch {
        // requête annulée ou réseau : on garde l'état précédent
      } finally {
        if (!controleur.signal.aborted) setRechercheEnCours(false);
      }
    }, 400);
    return () => {
      clearTimeout(minuteur);
      controleur.abort();
    };
  }, [recherche, readOnly]);

  const choisirResultat = (lieu: ResultatLieu) => {
    ignorerRecherche.current = true;
    setRecherche(lieu.nom);
    setResultats([]);
    setListeOuverte(false);
    gesteInterne.current = false; // on veut que la carte vole vers le résultat
    onChangeRef.current({ lat: lieu.lat, lng: lieu.lng });
  };

  return (
    <div className="flex flex-col gap-2">
      {!readOnly && (
        <div className="relative">
          <div className="flex items-center gap-2 rounded-xl border border-ink/15 bg-elevated px-3 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
            {rechercheEnCours ? (
              <Loader2 size={15} className="shrink-0 animate-spin text-ink/40" aria-hidden="true" />
            ) : (
              <Search size={15} className="shrink-0 text-ink/40" aria-hidden="true" />
            )}
            <input
              type="text"
              value={recherche}
              onChange={(event) => majRecherche(event.target.value)}
              onFocus={() => resultats.length > 0 && setListeOuverte(true)}
              onBlur={() => setTimeout(() => setListeOuverte(false), 120)}
              placeholder="Rechercher un lieu (école, quartier, repère…)"
              autoComplete="off"
              className="w-full bg-transparent py-2.5 text-sm text-ink placeholder:text-ink/35 focus:outline-none"
            />
          </div>

          {listeOuverte && resultats.length > 0 && (
            <ul className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-ink/15 bg-surface shadow-lg">
              {resultats.map((lieu, index) => (
                <li key={`${lieu.source}-${index}`}>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => choisirResultat(lieu)}
                    className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-ink/5"
                  >
                    <MapPin size={14} className="mt-0.5 shrink-0 text-ink/40" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{lieu.nom}</span>
                      {lieu.source === "connu" && (
                        <span className="text-[11px] font-medium text-brand">Lieu enregistré</span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {listeOuverte &&
            !rechercheEnCours &&
            resultats.length === 0 &&
            recherche.trim().length >= MIN_CARACTERES_RECHERCHE && (
              <p className="absolute left-0 right-0 top-full z-20 mt-1 rounded-xl border border-ink/15 bg-surface px-3 py-2 text-xs text-ink/55 shadow-lg">
                Aucun lieu trouvé. Place l’épingle à la main sur la carte.
              </p>
            )}
        </div>
      )}

      <div
        ref={conteneurRef}
        className="relative z-0 h-56 w-full overflow-hidden rounded-xl border border-ink/15 bg-ink/5"
        role="application"
        aria-label="Carte de localisation de la livraison"
      >
        {carteHs && (
          <span className="absolute inset-0 z-10 flex items-center justify-center bg-ink/5 px-4 text-center text-xs text-ink/50">
            {readOnly
              ? "Carte momentanément indisponible."
              : "Carte momentanément indisponible. Utilise « Ma position » ci-dessous."}
          </span>
        )}
        {!carteHs && !pretePourInteraction && (
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
