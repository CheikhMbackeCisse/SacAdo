"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { creerZone, modifierZone } from "@/lib/admin/zones-actions";
import type { Zone } from "@/lib/supabase/types";

export function ZonesEditor({ zones }: { zones: Zone[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [nouveauNom, setNouveauNom] = useState("");
  const [nouveau6j, setNouveau6j] = useState("0");
  const [nouveau24h, setNouveau24h] = useState("0");

  const enregistrer = async (zone: Zone, tarif6j: number, tarif24h: number) => {
    const result = await modifierZone(zone.id, { nom: zone.nom, tarif_6j: tarif6j, tarif_24h: tarif24h });
    if (!result.ok) setError(result.error);
    router.refresh();
  };

  const ajouterZone = async () => {
    if (!nouveauNom.trim()) return;
    const result = await creerZone({
      nom: nouveauNom.trim(),
      tarif_6j: Number(nouveau6j),
      tarif_24h: Number(nouveau24h),
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNouveauNom("");
    setNouveau6j("0");
    setNouveau24h("0");
    router.refresh();
  };

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <div className="overflow-hidden rounded-2xl border border-ink/10 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-left text-xs text-ink/50">
              <th className="px-4 py-3 font-medium">Zone</th>
              <th className="px-4 py-3 font-medium">Tarif 6j</th>
              <th className="px-4 py-3 font-medium">Tarif 24h</th>
            </tr>
          </thead>
          <tbody>
            {zones.map((zone) => (
              <tr key={zone.id} className="border-b border-ink/5 last:border-0">
                <td className="px-4 py-3 text-ink">{zone.nom}</td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    min={0}
                    defaultValue={zone.tarif_6j}
                    onBlur={(event) => enregistrer(zone, Number(event.target.value), zone.tarif_24h)}
                    className="w-24 rounded-lg border border-ink/15 px-2 py-1 text-sm"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    min={0}
                    defaultValue={zone.tarif_24h}
                    onBlur={(event) => enregistrer(zone, zone.tarif_6j, Number(event.target.value))}
                    className="w-24 rounded-lg border border-ink/15 px-2 py-1 text-sm"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-end gap-2 rounded-2xl border border-ink/10 bg-white p-4">
        <label className="flex flex-1 flex-col gap-1 text-xs">
          <span className="text-ink/60">Nouvelle zone</span>
          <input
            value={nouveauNom}
            onChange={(event) => setNouveauNom(event.target.value)}
            className="rounded-lg border border-ink/15 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-ink/60">Tarif 6j</span>
          <input
            type="number"
            min={0}
            value={nouveau6j}
            onChange={(event) => setNouveau6j(event.target.value)}
            className="w-24 rounded-lg border border-ink/15 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-ink/60">Tarif 24h</span>
          <input
            type="number"
            min={0}
            value={nouveau24h}
            onChange={(event) => setNouveau24h(event.target.value)}
            className="w-24 rounded-lg border border-ink/15 px-2 py-1.5 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={ajouterZone}
          className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-surface active:scale-95"
        >
          Ajouter
        </button>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
