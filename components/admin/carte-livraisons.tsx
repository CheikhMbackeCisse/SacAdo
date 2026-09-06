"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Check, Loader2, MapPin, Phone, X } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { changerStatutCommande } from "@/lib/admin/commandes-actions";
import { regionLaPlusProche } from "@/lib/senegal-regions";
import type { LivraisonCommande } from "@/lib/admin/livraisons-actions";
import type { Fournisseur, ModeLivraison } from "@/lib/supabase/types";

maplibregl.setWorkerUrl("/vendor/maplibre/maplibre-gl-worker.mjs");

const STYLE = "https://tiles.openfreemap.org/styles/liberty";
const DAKAR: [number, number] = [-17.4467, 14.6928];
const COULEUR_COMMANDE = "#0B3D91"; // bleu marque
const COULEUR_FOURNISSEUR = "#64B6AC"; // turquoise décoratif

// Filtre région : on regroupe les 14 régions en 3 zones logistiques.
const FILTRES_REGION = ["Dakar", "Thiès", "Autres régions"] as const;
type FiltreRegion = (typeof FILTRES_REGION)[number];

function regroupeRegion(nom: string): FiltreRegion {
  if (nom === "Dakar") return "Dakar";
  if (nom === "Thiès") return "Thiès";
  return "Autres régions";
}

type Selection =
  | { kind: "commande"; c: LivraisonCommande }
  | { kind: "fournisseur"; f: Fournisseur }
  | null;

export function CarteLivraisons({
  commandes,
  fournisseurs,
}: {
  commandes: LivraisonCommande[];
  fournisseurs: Fournisseur[];
}) {
  const router = useRouter();
  const conteneurRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const marqueursRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const cadreFait = useRef(false);
  const cadreSignatureRef = useRef("");

  const [prete, setPrete] = useState(false);
  const [carteHs, setCarteHs] = useState(false);
  const [filtreZone, setFiltreZone] = useState("");
  const [filtreMode, setFiltreMode] = useState<ModeLivraison | "">("");
  const [filtreRegion, setFiltreRegion] = useState<FiltreRegion | "">("");
  const [selection, setSelection] = useState<Selection>(null);
  const [marquage, setMarquage] = useState(false);

  const zones = useMemo(
    () => [...new Set(commandes.map((c) => c.zoneNom))].sort(),
    [commandes],
  );

  const commandesFiltrees = useMemo(
    () =>
      commandes.filter(
        (c) =>
          (!filtreZone || c.zoneNom === filtreZone) &&
          (!filtreMode || c.modeLivraison === filtreMode) &&
          (!filtreRegion || regroupeRegion(c.zoneNom) === filtreRegion),
      ),
    [commandes, filtreZone, filtreMode, filtreRegion],
  );

  const fournisseursFiltres = useMemo(
    () =>
      fournisseurs.filter(
        (f) =>
          f.lat != null &&
          f.lng != null &&
          (!filtreRegion ||
            regroupeRegion(regionLaPlusProche(f.lat, f.lng)) === filtreRegion),
      ),
    [fournisseurs, filtreRegion],
  );

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
      setPrete(true);
    });
    map.on("error", (e) => {
      const status = (e.error as unknown as { status?: number })?.status;
      if (status && status >= 400) setCarteHs(true);
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      marqueurs.clear();
    };
  }, []);

  // Synchronise les marqueurs avec la liste filtrée + les fournisseurs.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !prete) return;

    const voulus = new Map<string, { lng: number; lat: number; couleur: string }>();
    for (const c of commandesFiltrees) {
      voulus.set(`c-${c.id}`, { lng: c.lng, lat: c.lat, couleur: COULEUR_COMMANDE });
    }
    for (const f of fournisseursFiltres) {
      voulus.set(`f-${f.id}`, { lng: f.lng as number, lat: f.lat as number, couleur: COULEUR_FOURNISSEUR });
    }

    // Retirer ceux qui ne sont plus voulus.
    for (const [cle, marqueur] of marqueursRef.current) {
      if (!voulus.has(cle)) {
        marqueur.remove();
        marqueursRef.current.delete(cle);
      }
    }
    // Ajouter les nouveaux.
    for (const [cle, p] of voulus) {
      if (marqueursRef.current.has(cle)) continue;
      const marqueur = new maplibregl.Marker({ color: p.couleur }).setLngLat([p.lng, p.lat]).addTo(map);
      const el = marqueur.getElement();
      el.style.cursor = "pointer";
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (cle.startsWith("c-")) {
          const c = commandesFiltrees.find((x) => `c-${x.id}` === cle);
          if (c) setSelection({ kind: "commande", c });
        } else {
          const f = fournisseursFiltres.find((x) => `f-${x.id}` === cle);
          if (f) setSelection({ kind: "fournisseur", f });
        }
      });
      marqueursRef.current.set(cle, marqueur);
    }

    // Cadrage sur l'ensemble des points : à la première pose, puis à chaque
    // changement de filtre (la sélection visible bouge).
    const signature = `${filtreZone}|${filtreMode}|${filtreRegion}`;
    if (voulus.size > 0 && (!cadreFait.current || cadreSignatureRef.current !== signature)) {
      const bounds = new maplibregl.LngLatBounds();
      for (const p of voulus.values()) bounds.extend([p.lng, p.lat]);
      map.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: cadreFait.current ? 400 : 0 });
      cadreFait.current = true;
      cadreSignatureRef.current = signature;
    }
  }, [prete, commandesFiltrees, fournisseursFiltres, filtreZone, filtreMode, filtreRegion]);

  const marquerLivree = async (id: number) => {
    setMarquage(true);
    await changerStatutCommande(id, "livree");
    setMarquage(false);
    setSelection(null);
    router.refresh();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <div className="flex overflow-hidden rounded-full border border-ink/15">
          {FILTRES_REGION.map((r, i) => (
            <button
              key={r}
              type="button"
              onClick={() => setFiltreRegion((cur) => (cur === r ? "" : r))}
              className={`min-h-10 px-3 text-xs font-medium ${i > 0 ? "border-l border-ink/15" : ""} ${
                filtreRegion === r ? "bg-brand text-surface" : "text-ink/70"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <select
          value={filtreZone}
          onChange={(e) => setFiltreZone(e.target.value)}
          className="min-h-10 rounded-full border border-ink/15 px-3 text-sm"
        >
          <option value="">Toutes les zones</option>
          {zones.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </select>
        {(["24h", "6j"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setFiltreMode((cur) => (cur === m ? "" : m))}
            className={`min-h-10 rounded-full border px-3 text-xs font-medium ${
              filtreMode === m ? "border-brand bg-brand text-surface" : "border-ink/15 text-ink/70"
            }`}
          >
            {m === "24h" ? "24h" : "6 jours"}
          </button>
        ))}
        <span className="text-xs text-ink/50">
          {commandesFiltrees.length} commande{commandesFiltrees.length > 1 ? "s" : ""} à livrer
        </span>
      </div>

      {/* Carte : occupe toute la hauteur restante */}
      <div className="relative min-h-0 flex-1">
        <div
          ref={conteneurRef}
          className="h-full min-h-72 w-full overflow-hidden rounded-2xl border border-ink/15 bg-ink/5"
          role="application"
          aria-label="Carte des livraisons"
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

        {/* Légende */}
        <div className="absolute bottom-2 left-2 flex flex-col gap-1 rounded-xl bg-white/95 px-3 py-2 text-[11px] shadow">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: COULEUR_COMMANDE }} />
            Commande à livrer
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: COULEUR_FOURNISSEUR }} />
            Fournisseur
          </span>
        </div>

        {/* Panneau détail : superposé à la carte (bas sur mobile, droite sur desktop) */}
        {selection && (
          <div className="absolute inset-x-2 bottom-2 z-10 max-h-[calc(100%-1rem)] overflow-y-auto sm:left-auto sm:right-2 sm:w-80">
            {selection.kind === "commande" ? (
              <PanneauCommande
                c={selection.c}
                marquage={marquage}
                onMarquerLivree={() => marquerLivree(selection.c.id)}
                onFermer={() => setSelection(null)}
              />
            ) : (
              <div className="rounded-2xl border border-ink/10 bg-white p-4 text-sm shadow-lg">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-ink">{selection.f.nom}</p>
                  <button type="button" onClick={() => setSelection(null)} aria-label="Fermer">
                    <X size={16} className="text-ink/40" />
                  </button>
                </div>
                {selection.f.adresse && <p className="mt-1 text-ink/60">{selection.f.adresse}</p>}
                <p className="mt-1 text-xs text-ink/40">Point de retrait de marchandise</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PanneauCommande({
  c,
  marquage,
  onMarquerLivree,
  onFermer,
}: {
  c: LivraisonCommande;
  marquage: boolean;
  onMarquerLivree: () => void;
  onFermer: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-white p-4 text-sm shadow-lg">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-ink">Commande #{c.id}</p>
        <button type="button" onClick={onFermer} aria-label="Fermer">
          <X size={16} className="text-ink/40" />
        </button>
      </div>

      <p className="text-ink/80">{c.clientNom}</p>
      <a href={`tel:${c.clientTelephone}`} className="flex w-fit items-center gap-1.5 text-brand">
        <Phone size={13} aria-hidden="true" />
        {c.clientTelephone}
      </a>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink/60">
        <span>Zone : {c.zoneNom}</span>
        <span>Livraison : {c.modeLivraison}</span>
        <span className="font-semibold text-ink">{formatPrice(c.total)}</span>
      </div>

      {c.precisionLivreur && (
        <p className="rounded-lg bg-ink/[0.03] px-2.5 py-1.5 text-xs text-ink/70">
          <span className="font-medium text-ink">Précision : </span>
          {c.precisionLivreur}
        </p>
      )}

      <ul className="flex flex-col gap-0.5 text-xs text-ink/70">
        {c.articles.map((a, i) => (
          <li key={i}>
            {a.quantite} × {a.nom}
          </li>
        ))}
      </ul>

      <div className="mt-1 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onMarquerLivree}
          disabled={marquage}
          className="flex min-h-11 items-center gap-1.5 rounded-full bg-brand px-4 text-sm font-semibold text-on-brand active:scale-95 disabled:opacity-50"
        >
          {marquage ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          Marquer livrée
        </button>
        <a
          href={`https://www.google.com/maps?q=${c.lat},${c.lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-11 items-center gap-1.5 rounded-full border border-ink/15 px-4 text-sm font-medium text-ink/70"
        >
          <MapPin size={14} aria-hidden="true" />
          Itinéraire
        </a>
      </div>
    </div>
  );
}
