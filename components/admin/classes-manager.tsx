"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp } from "lucide-react";
import { creerClasse, modifierClasse, deplacerClasse } from "@/lib/admin/classes-actions";
import { ChampSelect } from "@/components/ui/champ-select";
import type { ClasseDb, Cycle } from "@/lib/supabase/types";

const LABELS_CYCLE: Record<Cycle, string> = {
  prescolaire: "Préscolaire",
  elementaire: "Élémentaire",
  college: "Collège",
  lycee: "Lycée",
};

export function ClassesManager({ classes }: { classes: ClasseDb[] }) {
  const router = useRouter();
  const [cycle, setCycle] = useState<Cycle | "">("");
  const [nomClasse, setNomClasse] = useState("");
  const [groupe, setGroupe] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const parCycle = new Map<Cycle, ClasseDb[]>();
  for (const c of classes) parCycle.set(c.cycle, [...(parCycle.get(c.cycle) ?? []), c]);

  const ajouter = async () => {
    if (!cycle || !nomClasse.trim()) {
      setError("Cycle et nom de la classe sont requis.");
      return;
    }
    setEnCours(true);
    setError(null);
    const result = await creerClasse({ cycle, classe: nomClasse.trim(), groupe: groupe.trim() || null });
    setEnCours(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNomClasse("");
    setGroupe("");
    router.refresh();
  };

  const patcher = async (id: number, patch: Parameters<typeof modifierClasse>[1]) => {
    const result = await modifierClasse(id, patch);
    if (!result.ok) setError(result.error);
    router.refresh();
  };

  const bouger = async (cycleClasse: Cycle, idsDuCycle: number[], id: number, direction: -1 | 1) => {
    const result = await deplacerClasse(cycleClasse, idsDuCycle, id, direction);
    if (!result.ok) setError(result.error);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-ink/10 bg-white p-4">
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-ink/60">Cycle</span>
          <ChampSelect
            options={Object.entries(LABELS_CYCLE).map(([v, label]) => ({ value: v, label }))}
            value={cycle}
            onChange={(v) => setCycle(v as Cycle | "")}
            placeholder="Choisir un cycle…"
            className="min-h-10 rounded-lg border border-ink/15 px-3 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-ink/60">Classe / série</span>
          <input
            value={nomClasse}
            onChange={(e) => setNomClasse(e.target.value)}
            placeholder="ex: Terminale S3"
            className="min-h-10 rounded-lg border border-ink/15 px-3 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-ink/60">Groupe (lycée)</span>
          <input
            value={groupe}
            onChange={(e) => setGroupe(e.target.value)}
            placeholder="ex: Séries scientifiques"
            className="min-h-10 rounded-lg border border-ink/15 px-3 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={ajouter}
          disabled={enCours}
          className="min-h-10 rounded-full bg-brand px-4 text-sm font-semibold text-surface disabled:opacity-50"
        >
          Ajouter
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}

      {(Object.keys(LABELS_CYCLE) as Cycle[]).map((c) => {
        const liste = parCycle.get(c) ?? [];
        if (liste.length === 0) return null;
        return (
          <div key={c} className="rounded-2xl border border-ink/10 bg-white p-4">
            <h2 className="mb-2 text-sm font-semibold text-ink">{LABELS_CYCLE[c]}</h2>
            <ul className="flex flex-col divide-y divide-ink/10">
              {liste.map((classe, index) => (
                <li key={classe.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col">
                      <button
                        type="button"
                        onClick={() => bouger(c, liste.map((x) => x.id), classe.id, -1)}
                        disabled={index === 0}
                        className="rounded p-0.5 text-ink/40 disabled:opacity-20"
                        aria-label="Monter"
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => bouger(c, liste.map((x) => x.id), classe.id, 1)}
                        disabled={index === liste.length - 1}
                        className="rounded p-0.5 text-ink/40 disabled:opacity-20"
                        aria-label="Descendre"
                      >
                        <ChevronDown size={14} />
                      </button>
                    </div>
                    <span className={classe.actif ? "text-ink" : "text-ink/40 line-through"}>{classe.classe}</span>
                    {classe.groupe && <span className="text-xs text-ink/40">({classe.groupe})</span>}
                  </div>
                  <button
                    type="button"
                    onClick={() => patcher(classe.id, { actif: !classe.actif })}
                    className={classe.actif ? "text-xs text-ink/50 hover:underline" : "text-xs font-medium text-brand hover:underline"}
                  >
                    {classe.actif ? "Masquer" : "Réafficher"}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
