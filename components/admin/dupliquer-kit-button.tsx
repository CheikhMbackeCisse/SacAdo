"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { dupliquerKit } from "@/lib/admin/kits-actions";
import { GAMMES } from "@/lib/gammes";
import { ChampSelect } from "@/components/ui/champ-select";
import type { Gamme } from "@/lib/supabase/types";

// « Dupliquer un kit existant » (ex. partir du Complet pour faire le
// Confort), puis modifier — ADMIN.md Lot 2.
export function DupliquerKitButton({ kitId, gammeActuelle, nom }: { kitId: number; gammeActuelle: Gamme; nom: string }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [gamme, setGamme] = useState<Gamme | "">("");
  const [nomCible, setNomCible] = useState(nom);
  const [error, setError] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const autresGammes = GAMMES.filter((g) => g.value !== gammeActuelle);

  const dupliquer = async () => {
    if (!gamme) {
      setError("Choisir la gamme cible.");
      return;
    }
    setEnCours(true);
    setError(null);
    const result = await dupliquerKit(kitId, { gamme, nom: nomCible.trim() || nom });
    setEnCours(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOuvert(false);
    router.push(`/admin/kits/${result.id}`);
  };

  if (!ouvert) {
    return (
      <button type="button" onClick={() => setOuvert(true)} className="text-ink/60 hover:underline">
        Dupliquer
      </button>
    );
  }

  return (
    <span className="flex flex-col items-end gap-1">
      <span className="flex flex-wrap items-center justify-end gap-1.5">
        <ChampSelect
          ariaLabel="Gamme cible"
          placeholder="Vers…"
          className="min-h-8 rounded-full border border-ink/15 px-2 text-xs"
          value={gamme}
          onChange={(v) => setGamme(v as Gamme | "")}
          options={autresGammes.map((g) => ({ value: g.value, label: g.label }))}
        />
        <input
          value={nomCible}
          onChange={(e) => setNomCible(e.target.value)}
          className="min-h-8 w-28 rounded-full border border-ink/15 px-2 text-xs"
        />
        <button
          type="button"
          onClick={dupliquer}
          disabled={enCours}
          className="rounded-full bg-brand px-2.5 py-1 text-xs font-semibold text-surface disabled:opacity-50"
        >
          OK
        </button>
        <button type="button" onClick={() => setOuvert(false)} className="text-xs text-ink/40">
          Annuler
        </button>
      </span>
      {error && <span className="text-[11px] text-red-600">{error}</span>}
    </span>
  );
}
