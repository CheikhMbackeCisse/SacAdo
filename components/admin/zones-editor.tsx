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
  const [nouveauMessage, setNouveauMessage] = useState("");

  const enregistrer = async (
    zone: Zone,
    champs: Partial<Pick<Zone, "tarif_6j" | "tarif_24h" | "message_special">>,
  ) => {
    const result = await modifierZone(zone.id, {
      nom: zone.nom,
      tarif_6j: champs.tarif_6j ?? zone.tarif_6j,
      tarif_24h: champs.tarif_24h ?? zone.tarif_24h,
      message_special:
        champs.message_special !== undefined ? champs.message_special : zone.message_special,
    });
    if (!result.ok) setError(result.error);
    router.refresh();
  };

  const ajouterZone = async () => {
    if (!nouveauNom.trim()) return;
    const result = await creerZone({
      nom: nouveauNom.trim(),
      tarif_6j: Number(nouveau6j),
      tarif_24h: Number(nouveau24h),
      message_special: nouveauMessage.trim() || null,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNouveauNom("");
    setNouveau6j("0");
    setNouveau24h("0");
    setNouveauMessage("");
    router.refresh();
  };

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <p className="text-sm text-ink/55">
        Le message spécial, s&apos;il est renseigné, remplace le délai « 24h / 6j » partout où
        il s&apos;affiche pour ce groupe (le prix reste affiché). Laisse-le vide pour un délai
        normal.
      </p>

      <div className="overflow-x-auto rounded-2xl border border-ink/10 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-left text-xs text-ink/50">
              <th className="px-4 py-3 font-medium">Zone</th>
              <th className="px-4 py-3 font-medium">Tarif 6j</th>
              <th className="px-4 py-3 font-medium">Tarif 24h</th>
              <th className="px-4 py-3 font-medium">Message spécial (remplace le délai)</th>
            </tr>
          </thead>
          <tbody>
            {zones.map((zone) => (
              <tr key={zone.id} className="border-b border-ink/5 last:border-0 align-top">
                <td className="px-4 py-3 text-ink">{zone.nom}</td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    min={0}
                    defaultValue={zone.tarif_6j}
                    onBlur={(event) => enregistrer(zone, { tarif_6j: Number(event.target.value) })}
                    className="w-24 rounded-lg border border-ink/15 min-h-10 px-3 text-sm"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    min={0}
                    defaultValue={zone.tarif_24h}
                    onBlur={(event) => enregistrer(zone, { tarif_24h: Number(event.target.value) })}
                    className="w-24 rounded-lg border border-ink/15 min-h-10 px-3 text-sm"
                  />
                </td>
                <td className="px-4 py-3">
                  <textarea
                    rows={2}
                    maxLength={300}
                    defaultValue={zone.message_special ?? ""}
                    placeholder="Aucun (délai normal)"
                    onBlur={(event) =>
                      enregistrer(zone, { message_special: event.target.value.trim() || null })
                    }
                    className="min-w-[15rem] rounded-lg border border-ink/15 px-3 py-2 text-sm"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-white p-4">
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-ink/60">Nouvelle zone</span>
          <input
            value={nouveauNom}
            onChange={(event) => setNouveauNom(event.target.value)}
            className="min-h-11 rounded-lg border border-ink/15 px-3 text-sm"
          />
        </label>
        <div className="flex gap-2">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-ink/60">Tarif 6j</span>
            <input
              type="number"
              min={0}
              value={nouveau6j}
              onChange={(event) => setNouveau6j(event.target.value)}
              className="min-h-11 w-28 rounded-lg border border-ink/15 px-3 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-ink/60">Tarif 24h</span>
            <input
              type="number"
              min={0}
              value={nouveau24h}
              onChange={(event) => setNouveau24h(event.target.value)}
              className="min-h-11 w-28 rounded-lg border border-ink/15 px-3 text-sm"
            />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-ink/60">Message spécial (facultatif)</span>
          <textarea
            rows={2}
            maxLength={300}
            value={nouveauMessage}
            onChange={(event) => setNouveauMessage(event.target.value)}
            className="rounded-lg border border-ink/15 px-3 py-2 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={ajouterZone}
          className="min-h-11 w-fit rounded-full bg-brand px-4 text-sm font-semibold text-surface active:scale-95"
        >
          Ajouter
        </button>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
