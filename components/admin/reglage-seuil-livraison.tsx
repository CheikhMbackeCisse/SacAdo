"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { reglerSeuilLivraisonGratuite } from "@/lib/admin/zones-actions";

// Montant proposé quand on réactive la livraison gratuite après l'avoir
// désactivée (CORRECTIONS_V11 lot 1) : dernière valeur connue, ou ce défaut.
const SEUIL_DEFAUT_A_LA_REACTIVATION = 75000;

export function ReglageSeuilLivraison({ valeur }: { valeur: number | null }) {
  const router = useRouter();
  const [activee, setActivee] = useState(valeur !== null);
  const [n, setN] = useState(String(valeur ?? SEUIL_DEFAUT_A_LA_REACTIVATION));
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const modifie = activee !== (valeur !== null) || (activee && Number(n) !== valeur);

  const enregistrer = async () => {
    setSaving(true);
    setError(null);
    const res = await reglerSeuilLivraisonGratuite(activee ? Number(n) : null);
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
      <label className="flex items-center gap-1.5 text-ink/70">
        <input
          type="checkbox"
          checked={activee}
          onChange={(e) => setActivee(e.target.checked)}
          className="h-4 w-4 rounded border-ink/25"
        />
        Livraison gratuite activée
      </label>
      {activee && (
        <>
          <span className="text-ink/70">à partir de</span>
          <input
            type="number"
            min={0}
            value={n}
            onChange={(e) => setN(e.target.value)}
            className="w-24 rounded-lg border border-ink/15 px-2 py-1 text-ink focus:border-brand focus:outline-none"
          />
          <span className="text-ink/50">FCFA</span>
        </>
      )}
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
