"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { reglerToursMax } from "@/lib/admin/negociation-actions";

export function ReglageToursMax({ valeur }: { valeur: number }) {
  const router = useRouter();
  const [n, setN] = useState(String(valeur));
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const modifie = Number(n) !== valeur;

  const enregistrer = async () => {
    setSaving(true);
    setError(null);
    const res = await reglerToursMax(Number(n));
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setOk(true);
    setTimeout(() => setOk(false), 1500);
    router.refresh();
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-ink/10 bg-white px-3.5 py-2.5 text-sm">
      <span className="text-ink/70">Limite d&apos;allers-retours par négociation</span>
      <input
        type="number"
        min={2}
        max={20}
        value={n}
        onChange={(e) => setN(e.target.value)}
        className="w-16 rounded-lg border border-ink/15 px-2 py-1 text-ink focus:border-brand focus:outline-none"
      />
      {modifie && (
        <button
          type="button"
          onClick={enregistrer}
          disabled={saving}
          className="rounded-full bg-brand px-3 py-1 text-xs font-semibold text-surface disabled:opacity-50"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : "Enregistrer"}
        </button>
      )}
      {ok && (
        <span className="flex items-center gap-1 text-xs font-medium text-success">
          <Check size={12} /> Enregistré
        </span>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
