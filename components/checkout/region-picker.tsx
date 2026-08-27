"use client";

import { useMemo, useRef, useState } from "react";
import { Check, MapPin } from "lucide-react";
import type { Zone } from "@/lib/supabase/types";

type RegionPickerProps = {
  zones: Zone[];
  zoneId: number | null;
  onChange: (zoneId: number) => void;
};

// Combobox ancré : le champ EST le déclencheur (pas de bouton séparé ni de
// feuille détachée en bas d'écran) — la liste s'ouvre juste en dessous, à
// l'endroit même du champ, avec filtrage en tapant (cf. règle "Autocomplete"
// du skill ui-ux-pro-max : prédictions au fil de la frappe plutôt qu'un
// <select> natif ou une liste plein écran).
export function RegionPicker({ zones, zoneId, onChange }: RegionPickerProps) {
  const [ouvert, setOuvert] = useState(false);
  const [recherche, setRecherche] = useState("");
  const fermetureDifferee = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zoneSelectionnee = zones.find((z) => z.id === zoneId) ?? null;

  const zonesFiltrees = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return zones;
    return zones.filter((z) => z.nom.toLowerCase().includes(q));
  }, [zones, recherche]);

  return (
    <div className="relative">
      <div className="relative">
        <MapPin
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand"
          aria-hidden="true"
        />
        <input
          role="combobox"
          aria-expanded={ouvert}
          aria-haspopup="listbox"
          aria-controls="region-listbox"
          value={ouvert ? recherche : (zoneSelectionnee?.nom ?? "")}
          onChange={(event) => setRecherche(event.target.value)}
          onFocus={() => {
            if (fermetureDifferee.current) clearTimeout(fermetureDifferee.current);
            setRecherche("");
            setOuvert(true);
          }}
          onBlur={() => {
            // Délai court : laisse le clic sur une option s'exécuter avant la fermeture.
            fermetureDifferee.current = setTimeout(() => setOuvert(false), 120);
          }}
          placeholder="Rechercher une région…"
          className="w-full rounded-xl border border-ink/15 bg-elevated py-2.5 pl-9 pr-3 text-sm text-ink placeholder:text-ink/40 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
        />
      </div>

      {ouvert && (
        <div
          id="region-listbox"
          role="listbox"
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border border-ink/10 bg-elevated py-1 shadow-lg"
        >
          {zonesFiltrees.length === 0 && (
            <p className="px-3 py-3 text-center text-sm text-ink/50">Aucune région ne correspond.</p>
          )}
          {zonesFiltrees.map((zone) => {
            const active = zone.id === zoneId;
            return (
              <button
                key={zone.id}
                type="button"
                role="option"
                aria-selected={active}
                onMouseDown={(event) => {
                  // Empêche le blur du champ de se déclencher avant le clic.
                  event.preventDefault();
                  onChange(zone.id);
                  setOuvert(false);
                }}
                className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm active:bg-ink/5 ${
                  active ? "font-semibold text-brand" : "text-ink"
                }`}
              >
                {zone.nom}
                {active && <Check size={16} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
