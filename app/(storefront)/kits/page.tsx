"use client";

import Link from "next/link";
import { useState } from "react";
import { GraduationCap } from "lucide-react";
import { CYCLES, type CycleDef } from "@/lib/cycles";

export default function KitsPage() {
  const [selected, setSelected] = useState<CycleDef | null>(null);

  return (
    <div className="animate-fade-in-up flex flex-col gap-5 px-4 py-6">
      <div>
        <h1 className="font-heading text-xl font-bold text-ink">Kits scolaires</h1>
        <p className="text-sm text-ink/60">Choisis le cycle, puis la classe.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {CYCLES.map((cycle) => {
          const active = selected?.value === cycle.value;
          return (
            <button
              key={cycle.value}
              type="button"
              aria-pressed={active}
              onClick={() => setSelected(cycle)}
              className={`flex flex-col items-center gap-2 rounded-2xl border p-4 text-center transition-colors active:scale-95 ${
                active ? "border-brand bg-brand/5" : "border-ink/10 bg-white"
              }`}
            >
              <span
                className={`flex size-12 items-center justify-center rounded-2xl ${
                  active ? "bg-brand text-surface" : "bg-brand/10 text-brand"
                }`}
              >
                <GraduationCap size={22} aria-hidden="true" />
              </span>
              <span className="text-sm font-medium text-ink">{cycle.label}</span>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="animate-fade-in-up flex flex-col gap-2">
          <span className="text-xs font-medium text-ink/60">Classe — {selected.label}</span>
          <div className="flex flex-wrap gap-2">
            {selected.classes.map((niveau) => (
              <Link
                key={niveau}
                href={`/kits/${selected.value}/${encodeURIComponent(niveau)}`}
                className="rounded-full border border-ink/15 bg-white px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-brand hover:text-brand active:scale-95"
              >
                {niveau}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
