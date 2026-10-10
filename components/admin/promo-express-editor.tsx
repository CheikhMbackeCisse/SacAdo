"use client";

import { useState, useTransition } from "react";
import { enregistrerConfigPromoExpress } from "@/lib/admin/promo-express-actions";
import type { ConfigPromoExpress } from "@/lib/promo-express";

const JOURS = [
  { value: 0, label: "Dim" },
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mer" },
  { value: 4, label: "Jeu" },
  { value: 5, label: "Ven" },
  { value: 6, label: "Sam" },
];

export function PromoExpressEditor({ initial }: { initial: ConfigPromoExpress }) {
  const [config, setConfig] = useState(initial);
  const [nouvelleDate, setNouvelleDate] = useState("");
  const [enCours, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const toggleJour = (j: number) =>
    setConfig((c) => ({
      ...c,
      joursRecurrents: c.joursRecurrents.includes(j)
        ? c.joursRecurrents.filter((x) => x !== j)
        : [...c.joursRecurrents, j].sort(),
    }));

  const ajouterDate = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nouvelleDate)) return;
    if (config.datesPonctuelles.includes(nouvelleDate)) return;
    setConfig((c) => ({ ...c, datesPonctuelles: [...c.datesPonctuelles, nouvelleDate].sort() }));
    setNouvelleDate("");
  };

  const retirerDate = (d: string) =>
    setConfig((c) => ({ ...c, datesPonctuelles: c.datesPonctuelles.filter((x) => x !== d) }));

  const enregistrer = () => {
    setMessage(null);
    startTransition(async () => {
      const res = await enregistrerConfigPromoExpress(config);
      setMessage(res.ok ? "Enregistré." : res.error);
    });
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-ink/10 bg-white p-4">
      <label className="flex items-center gap-2 text-sm font-medium text-ink">
        <input
          type="checkbox"
          checked={config.actif}
          onChange={(e) => setConfig((c) => ({ ...c, actif: e.target.checked }))}
          className="size-4 accent-brand"
        />
        Promo express active
      </label>

      <div>
        <p className="mb-1.5 text-xs font-medium text-ink/60">Jours récurrents</p>
        <div className="flex flex-wrap gap-1.5">
          {JOURS.map((j) => (
            <button
              key={j.value}
              type="button"
              onClick={() => toggleJour(j.value)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                config.joursRecurrents.includes(j.value) ? "border-brand bg-brand text-surface" : "border-ink/15 text-ink/70"
              }`}
            >
              {j.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium text-ink/60">Dates ponctuelles (tournées d&apos;achat)</p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={nouvelleDate}
            onChange={(e) => setNouvelleDate(e.target.value)}
            className="rounded-lg border border-ink/15 px-2 py-1.5 text-sm text-ink"
          />
          <button type="button" onClick={ajouterDate} className="rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/70">
            Ajouter
          </button>
        </div>
        {config.datesPonctuelles.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {config.datesPonctuelles.map((d) => (
              <li key={d} className="flex items-center gap-1.5 rounded-full bg-ink/5 px-3 py-1 text-xs text-ink/70">
                {d}
                <button type="button" onClick={() => retirerDate(d)} className="text-ink/40 hover:text-ink">
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <label className="flex items-center gap-2 text-xs text-ink/60">
        Heure limite (Dakar)
        <input
          type="time"
          value={config.heureLimite}
          onChange={(e) => setConfig((c) => ({ ...c, heureLimite: e.target.value }))}
          className="rounded-lg border border-ink/15 px-2 py-1.5 text-sm text-ink"
        />
      </label>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={enregistrer}
          disabled={enCours}
          className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-on-brand disabled:opacity-50"
        >
          Enregistrer
        </button>
        {message && <span className="text-xs text-ink/60">{message}</span>}
      </div>
    </div>
  );
}
