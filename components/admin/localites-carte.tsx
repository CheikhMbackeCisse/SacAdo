"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Check, Loader2, MapPin, X } from "lucide-react";
import {
  creerLocaliteSurCarte,
  definirRayonLocalite,
  definirZoneLocalite,
  deplacerLocalite,
} from "@/lib/admin/localites-actions";
import { cercleGeoJSON } from "@/lib/geo-circle";
import type { Fournisseur, Localite, Zone } from "@/lib/supabase/types";

maplibregl.setWorkerUrl("/vendor/maplibre/maplibre-gl-worker.mjs");

const STYLE = "https://tiles.openfreemap.org/styles/liberty";
const DAKAR: [number, number] = [-17.4467, 14.6928];
// Vert « statut positif » (palette marque) : distinct de la palette des
// groupes de livraison ci-dessous, pour que les fournisseurs se reconnaissent
// d'un coup d'œil sur la carte (PROMPT_PARTAGE_MOBILIER_FOURNISSEURS Lot 4).
const COULEUR_FOURNISSEUR = "#16A34A";
const PALETTE = [
  "#0B3D91",
  "#E07B39",
  "#16A34A",
  "#64B6AC",
  "#9333EA",
  "#DC2626",
  "#0891B2",
  "#CA8A04",
  "#BE185D",
  "#4D7C0F",
];

type Mode =
  | { kind: "normal" }
  | { kind: "ajout" }
  | { kind: "ajout_point"; lat: number; lng: number }
  | { kind: "placer"; localiteId: number }
  | { kind: "dessiner"; localiteId: number; points: [number, number][] };

type SelectionFournisseur = { kind: "fournisseur"; f: Fournisseur };

export function LocalitesCarte({
  localites,
  groupes,
  fournisseurs,
}: {
  localites: Localite[];
  groupes: Zone[];
  fournisseurs: Fournisseur[];
}) {
  const router = useRouter();
  const conteneurRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const marqueursRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const cadreFait = useRef(false);
  const modeRef = useRef<Mode>({ kind: "normal" });

  const [prete, setPrete] = useState(false);
  const [carteHs, setCarteHs] = useState(false);
  const [mode, setMode] = useState<Mode>({ kind: "normal" });
  const [selectionId, setSelectionId] = useState<number | null>(null);
  const [selectionFournisseur, setSelectionFournisseur] = useState<SelectionFournisseur | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [nomAjout, setNomAjout] = useState("");
  const [groupeAjout, setGroupeAjout] = useState<number | "">(groupes[0]?.id ?? "");

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const couleurParGroupe = useMemo(() => {
    const triees = [...groupes].sort((a, b) => a.id - b.id);
    const m = new Map<number, string>();
    triees.forEach((g, i) => m.set(g.id, PALETTE[i % PALETTE.length]));
    return m;
  }, [groupes]);

  const nomGroupe = (id: number) => groupes.find((g) => g.id === id)?.nom ?? "—";

  const avecCoords = useMemo(() => localites.filter((l) => l.lat != null && l.lng != null), [localites]);
  const sansCoords = useMemo(() => localites.filter((l) => l.lat == null || l.lng == null), [localites]);
  const fournisseursAvecCoords = useMemo(
    () => fournisseurs.filter((f) => f.lat != null && f.lng != null),
    [fournisseurs],
  );
  const fournisseursSansCoords = useMemo(
    () => fournisseurs.filter((f) => f.lat == null || f.lng == null),
    [fournisseurs],
  );
  const selection = localites.find((l) => l.id === selectionId) ?? null;

  async function deplacerLocaliteEtRafraichir(id: number, lat: number, lng: number) {
    setEnCours(true);
    const res = await deplacerLocalite(id, lat, lng);
    setEnCours(false);
    if (!res.ok) setErreur(res.error);
    router.refresh();
  }

  async function placer(id: number, lat: number, lng: number) {
    setEnCours(true);
    setErreur(null);
    const res = await deplacerLocalite(id, lat, lng);
    setEnCours(false);
    if (!res.ok) {
      setErreur(res.error);
      return;
    }
    setMode({ kind: "normal" });
    setSelectionId(id);
    router.refresh();
  }

  // Init carte, une fois.
  useEffect(() => {
    if (!conteneurRef.current) return;
    const marqueurs = marqueursRef.current;
    const map = new maplibregl.Map({
      container: conteneurRef.current,
      style: STYLE,
      center: DAKAR,
      zoom: 11,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      map.resize();
      // Sources pour le rayon de couverture (sélection) et le dessin de zone en cours.
      map.addSource("rayon", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: "rayon-fill",
        type: "fill",
        source: "rayon",
        paint: { "fill-color": "#0B3D91", "fill-opacity": 0.08 },
      });
      map.addLayer({
        id: "rayon-ligne",
        type: "line",
        source: "rayon",
        paint: { "line-color": "#0B3D91", "line-width": 1.5, "line-dasharray": [2, 2] },
      });

      map.addSource("zones-dessinees", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: "zones-dessinees-fill",
        type: "fill",
        source: "zones-dessinees",
        paint: { "fill-color": ["get", "couleur"], "fill-opacity": 0.12 },
      });
      map.addLayer({
        id: "zones-dessinees-ligne",
        type: "line",
        source: "zones-dessinees",
        paint: { "line-color": ["get", "couleur"], "line-width": 1.5 },
      });

      map.addSource("dessin-en-cours", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: "dessin-en-cours-ligne",
        type: "line",
        source: "dessin-en-cours",
        paint: { "line-color": "#E07B39", "line-width": 2 },
      });
      map.addLayer({
        id: "dessin-en-cours-points",
        type: "circle",
        source: "dessin-en-cours",
        filter: ["==", ["geometry-type"], "Point"],
        paint: { "circle-radius": 4, "circle-color": "#E07B39" },
      });

      setPrete(true);
    });
    map.on("error", (e) => {
      const status = (e.error as unknown as { status?: number })?.status;
      if (status && status >= 400) setCarteHs(true);
    });

    map.on("click", (event) => {
      const m = modeRef.current;
      const { lat, lng } = event.lngLat;
      if (m.kind === "ajout") {
        setMode({ kind: "ajout_point", lat, lng });
      } else if (m.kind === "placer") {
        placer(m.localiteId, lat, lng);
      } else if (m.kind === "dessiner") {
        const points: [number, number][] = [...m.points, [lng, lat]];
        setMode({ kind: "dessiner", localiteId: m.localiteId, points });
      }
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      marqueurs.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Synchronise les marqueurs avec les localités géocodées et les fournisseurs
  // positionnés (PROMPT_PARTAGE_MOBILIER_FOURNISSEURS Lot 4) : ces derniers ne
  // sont pas déplaçables ici (ça se fait depuis /admin/fournisseurs), juste
  // visibles en vert pour repérer d'un coup d'œil les points de retrait par
  // rapport aux zones de livraison.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !prete) return;

    const voulus = new Set([
      ...avecCoords.map((l) => `l-${l.id}`),
      ...fournisseursAvecCoords.map((f) => `f-${f.id}`),
    ]);
    for (const [cle, marqueur] of marqueursRef.current) {
      if (!voulus.has(cle)) {
        marqueur.remove();
        marqueursRef.current.delete(cle);
      }
    }
    for (const l of avecCoords) {
      const couleur = couleurParGroupe.get(l.groupe_id) ?? PALETTE[0];
      const cle = `l-${l.id}`;
      let marqueur = marqueursRef.current.get(cle);
      if (!marqueur) {
        marqueur = new maplibregl.Marker({ color: couleur, draggable: true })
          .setLngLat([l.lng as number, l.lat as number])
          .addTo(map);
        marqueur.on("dragend", () => {
          const { lat, lng } = (marqueur as maplibregl.Marker).getLngLat();
          deplacerLocaliteEtRafraichir(l.id, lat, lng);
        });
        const el = marqueur.getElement();
        el.style.cursor = "pointer";
        el.addEventListener("click", (ev) => {
          ev.stopPropagation();
          setSelectionFournisseur(null);
          setSelectionId(l.id);
        });
        marqueursRef.current.set(cle, marqueur);
      } else {
        marqueur.setLngLat([l.lng as number, l.lat as number]);
      }
    }
    for (const f of fournisseursAvecCoords) {
      const cle = `f-${f.id}`;
      if (marqueursRef.current.has(cle)) continue;
      const marqueur = new maplibregl.Marker({ color: COULEUR_FOURNISSEUR })
        .setLngLat([f.lng as number, f.lat as number])
        .addTo(map);
      const el = marqueur.getElement();
      el.style.cursor = "pointer";
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        setSelectionId(null);
        setSelectionFournisseur({ kind: "fournisseur", f });
      });
      marqueursRef.current.set(cle, marqueur);
    }

    if (!cadreFait.current && voulus.size > 0) {
      const bounds = new maplibregl.LngLatBounds();
      for (const l of avecCoords) bounds.extend([l.lng as number, l.lat as number]);
      for (const f of fournisseursAvecCoords) bounds.extend([f.lng as number, f.lat as number]);
      map.fitBounds(bounds, { padding: 60, maxZoom: 13, duration: 0 });
      cadreFait.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prete, avecCoords, fournisseursAvecCoords, couleurParGroupe]);

  // Zones dessinées déjà enregistrées (toutes localités).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !prete) return;
    const source = map.getSource("zones-dessinees") as maplibregl.GeoJSONSource | undefined;
    if (!source) return;
    const features = localites
      .filter((l) => l.zone_polygone && l.zone_polygone.length >= 3)
      .map((l) => ({
        type: "Feature" as const,
        properties: { couleur: couleurParGroupe.get(l.groupe_id) ?? PALETTE[0] },
        geometry: { type: "Polygon" as const, coordinates: [l.zone_polygone as [number, number][]] },
      }));
    source.setData({ type: "FeatureCollection", features });
  }, [prete, localites, couleurParGroupe]);

  // Rayon de couverture de la localité sélectionnée (prévisualisation).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !prete) return;
    const source = map.getSource("rayon") as maplibregl.GeoJSONSource | undefined;
    if (!source) return;
    if (!selection || selection.lat == null || selection.lng == null || selection.zone_polygone) {
      source.setData({ type: "FeatureCollection", features: [] });
      return;
    }
    const anneau = cercleGeoJSON(selection.lat, selection.lng, selection.rayon_km);
    source.setData({
      type: "FeatureCollection",
      features: [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [anneau] } }],
    });
  }, [prete, selection]);

  // Prévisualisation du dessin de zone en cours.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !prete) return;
    const source = map.getSource("dessin-en-cours") as maplibregl.GeoJSONSource | undefined;
    if (!source) return;
    if (mode.kind !== "dessiner" || mode.points.length === 0) {
      source.setData({ type: "FeatureCollection", features: [] });
      return;
    }
    const features: GeoJSON.Feature[] = mode.points.map((p) => ({
      type: "Feature",
      properties: {},
      geometry: { type: "Point", coordinates: p },
    }));
    if (mode.points.length >= 2) {
      features.push({
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: [...mode.points, mode.points[0]] },
      });
    }
    source.setData({ type: "FeatureCollection", features });
  }, [prete, mode]);

  async function validerAjout(point: { lat: number; lng: number }) {
    if (!nomAjout.trim() || groupeAjout === "") return;
    setEnCours(true);
    setErreur(null);
    const res = await creerLocaliteSurCarte(nomAjout.trim(), groupeAjout, point.lat, point.lng);
    setEnCours(false);
    if (!res.ok) {
      setErreur(res.error);
      return;
    }
    setNomAjout("");
    setMode({ kind: "normal" });
    router.refresh();
  }

  async function changerRayon(id: number, rayon: number) {
    setEnCours(true);
    const res = await definirRayonLocalite(id, rayon);
    setEnCours(false);
    if (!res.ok) setErreur(res.error);
    router.refresh();
  }

  async function terminerZone() {
    if (mode.kind !== "dessiner" || mode.points.length < 3) return;
    setEnCours(true);
    setErreur(null);
    const res = await definirZoneLocalite(mode.localiteId, mode.points);
    setEnCours(false);
    if (!res.ok) {
      setErreur(res.error);
      return;
    }
    setMode({ kind: "normal" });
    router.refresh();
  }

  async function effacerZone(id: number) {
    setEnCours(true);
    const res = await definirZoneLocalite(id, null);
    setEnCours(false);
    if (!res.ok) setErreur(res.error);
    router.refresh();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {sansCoords.length > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-3">
          <p className="mb-2 text-xs font-semibold text-red-700">
            {sansCoords.length} localité{sansCoords.length > 1 ? "s" : ""} sans coordonnées — à placer à la main
          </p>
          <div className="flex flex-wrap gap-2">
            {sansCoords.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setMode({ kind: "placer", localiteId: l.id })}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                  mode.kind === "placer" && mode.localiteId === l.id
                    ? "border-brand bg-brand text-surface"
                    : "border-red-300 bg-white text-red-700"
                }`}
              >
                {l.nom} ({nomGroupe(l.groupe_id)})
              </button>
            ))}
          </div>
          {mode.kind === "placer" && (
            <p className="mt-2 text-xs text-red-700">Clique sur la carte à l&apos;emplacement voulu.</p>
          )}
        </div>
      )}

      {fournisseursSansCoords.length > 0 && (
        <div className="rounded-2xl border border-ink/10 bg-ink/[0.03] p-3">
          <p className="mb-2 text-xs font-semibold text-ink/60">
            Position à compléter : {fournisseursSansCoords.map((f) => f.nom).join(", ")}
          </p>
          <Link href="/admin/fournisseurs" className="text-xs text-brand hover:underline">
            Renseigner leur position →
          </Link>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button
          type="button"
          onClick={() => setMode(mode.kind === "ajout" || mode.kind === "ajout_point" ? { kind: "normal" } : { kind: "ajout" })}
          className={`min-h-10 rounded-full border px-3 text-xs font-medium ${
            mode.kind === "ajout" || mode.kind === "ajout_point"
              ? "border-brand bg-brand text-surface"
              : "border-ink/15 text-ink/70"
          }`}
        >
          {mode.kind === "ajout" || mode.kind === "ajout_point" ? "Annuler l'ajout" : "+ Ajouter en cliquant sur la carte"}
        </button>
        {mode.kind === "ajout" && (
          <span className="text-xs text-ink/50">Clique sur la carte à l&apos;emplacement de la nouvelle localité.</span>
        )}
        {mode.kind === "dessiner" && (
          <span className="flex items-center gap-2 text-xs text-brand">
            Dessin de zone : {mode.points.length} point{mode.points.length > 1 ? "s" : ""} — clique pour ajouter un point
            <button
              type="button"
              onClick={terminerZone}
              disabled={mode.points.length < 3 || enCours}
              className="rounded-full bg-brand px-2.5 py-1 text-[11px] font-semibold text-on-brand disabled:opacity-50"
            >
              Terminer
            </button>
            <button
              type="button"
              onClick={() => setMode({ kind: "normal" })}
              className="rounded-full border border-ink/15 px-2.5 py-1 text-[11px] font-medium text-ink/70"
            >
              Annuler
            </button>
          </span>
        )}
        {erreur && <span className="text-xs text-red-600">{erreur}</span>}
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={conteneurRef}
          className="h-full min-h-72 w-full overflow-hidden rounded-2xl border border-ink/15 bg-ink/5"
          role="application"
          aria-label="Carte des localités"
        />
        {carteHs && (
          <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-ink/5 px-4 text-center text-xs text-ink/50">
            Carte momentanément indisponible.
          </span>
        )}
        {!carteHs && !prete && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-ink/40">
            Chargement de la carte…
          </span>
        )}

        {/* Légende par groupe + fournisseurs (en vert, Lot 4) */}
        <div className="absolute bottom-2 left-2 flex max-w-[11rem] flex-col gap-1 rounded-xl bg-white/95 px-3 py-2 text-[11px] shadow">
          {[...groupes]
            .sort((a, b) => a.id - b.id)
            .map((g) => (
              <span key={g.id} className="flex items-center gap-1.5">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: couleurParGroupe.get(g.id) }} />
                <span className="truncate">{g.nom}</span>
              </span>
            ))}
          {fournisseursAvecCoords.length > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: COULEUR_FOURNISSEUR }} />
              <span className="truncate">En vert : nos fournisseurs</span>
            </span>
          )}
        </div>

        {/* Mini-formulaire d'ajout, après clic sur la carte en mode ajout */}
        {mode.kind === "ajout_point" && (
          <div className="absolute inset-x-2 bottom-2 z-10 sm:left-auto sm:right-2 sm:w-72">
            <div className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-white p-4 text-sm shadow-lg">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-ink">Nouvelle localité</p>
                <button type="button" onClick={() => setMode({ kind: "ajout" })} aria-label="Fermer">
                  <X size={16} className="text-ink/40" />
                </button>
              </div>
              <input
                type="text"
                value={nomAjout}
                onChange={(e) => setNomAjout(e.target.value)}
                placeholder="Nom de la localité"
                className="rounded-lg border border-ink/15 px-3 py-2 text-sm"
                autoFocus
              />
              <select
                value={groupeAjout}
                onChange={(e) => setGroupeAjout(Number(e.target.value))}
                className="rounded-lg border border-ink/15 px-3 py-2 text-sm"
              >
                {groupes.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nom}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!nomAjout.trim() || enCours}
                onClick={() => validerAjout({ lat: mode.lat, lng: mode.lng })}
                className="flex min-h-10 items-center justify-center gap-1.5 rounded-full bg-brand text-sm font-semibold text-on-brand disabled:opacity-50"
              >
                {enCours ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Ajouter
              </button>
            </div>
          </div>
        )}

        {/* Panneau détail de la localité sélectionnée */}
        {selection && mode.kind === "normal" && (
          <div className="absolute inset-x-2 bottom-2 z-10 max-h-[calc(100%-1rem)] overflow-y-auto sm:left-auto sm:right-2 sm:w-80">
            <div className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-white p-4 text-sm shadow-lg">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-ink">{selection.nom}</p>
                  <p className="text-xs text-ink/50">{nomGroupe(selection.groupe_id)}</p>
                </div>
                <button type="button" onClick={() => setSelectionId(null)} aria-label="Fermer">
                  <X size={16} className="text-ink/40" />
                </button>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-ink/60">Rayon de couverture (km)</label>
                <input
                  type="number"
                  min={0.5}
                  max={30}
                  step={0.5}
                  defaultValue={selection.rayon_km}
                  disabled={!!selection.zone_polygone}
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v) && v !== selection.rayon_km) changerRayon(selection.id, v);
                  }}
                  className="w-full rounded-lg border border-ink/15 px-3 py-1.5 text-sm disabled:opacity-40"
                />
                {selection.zone_polygone && (
                  <p className="mt-1 text-[11px] text-ink/50">Une zone dessinée remplace le rayon.</p>
                )}
              </div>

              {selection.zone_polygone ? (
                <button
                  type="button"
                  onClick={() => effacerZone(selection.id)}
                  disabled={enCours}
                  className="rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/70 disabled:opacity-50"
                >
                  Effacer la zone ({selection.zone_polygone.length} points)
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setMode({ kind: "dessiner", localiteId: selection.id, points: [] })}
                  className="rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/70"
                >
                  Dessiner une zone
                </button>
              )}

              <button
                type="button"
                onClick={() => setMode({ kind: "placer", localiteId: selection.id })}
                className="flex items-center justify-center gap-1.5 rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/70"
              >
                <MapPin size={13} aria-hidden="true" />
                Replacer en cliquant sur la carte
              </button>
            </div>
          </div>
        )}

        {/* Panneau détail du fournisseur sélectionné (Lot 4) : lecture seule,
            la position se modifie depuis /admin/fournisseurs. */}
        {selectionFournisseur && (
          <div className="absolute inset-x-2 bottom-2 z-10 max-h-[calc(100%-1rem)] overflow-y-auto sm:left-auto sm:right-2 sm:w-80">
            <div className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-white p-4 text-sm shadow-lg">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-ink">{selectionFournisseur.f.nom}</p>
                <button type="button" onClick={() => setSelectionFournisseur(null)} aria-label="Fermer">
                  <X size={16} className="text-ink/40" />
                </button>
              </div>
              {selectionFournisseur.f.adresse && (
                <p className="text-ink/60">{selectionFournisseur.f.adresse}</p>
              )}
              <p className="text-xs text-ink/40">Point de retrait de marchandise</p>
              <a
                href={`https://www.google.com/maps?q=${selectionFournisseur.f.lat},${selectionFournisseur.f.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-fit items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/70"
              >
                <MapPin size={13} aria-hidden="true" />
                Ouvrir dans Google Maps
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
