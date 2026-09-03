"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { creerKit } from "@/lib/admin/kits-actions";
import { GAMMES } from "@/lib/gammes";
import { ChampSelect } from "@/components/ui/champ-select";
import type { Cycle, Gamme } from "@/lib/supabase/types";

const CHAMP = "rounded-lg border border-ink/15 min-h-11 px-3 text-sm";

export function NouveauKitForm() {
  const router = useRouter();
  // Aucun cycle / gamme par défaut : choix explicite obligatoire.
  const [cycle, setCycle] = useState<Cycle | "">("");
  const [gamme, setGamme] = useState<Gamme | "">("");
  const [niveau, setNiveau] = useState("");
  const [nom, setNom] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (cycle === "") {
      setError("Veuillez choisir un cycle.");
      return;
    }
    if (gamme === "") {
      setError("Veuillez choisir une gamme.");
      return;
    }
    setSubmitting(true);
    const result = await creerKit({ cycle, gamme, niveau: niveau.trim(), nom: nom.trim() });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNiveau("");
    setNom("");
    router.refresh();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-white p-4 sm:flex-row sm:flex-wrap sm:items-end"
    >
      <label className="flex flex-col gap-1 text-xs sm:w-auto">
        <span className="text-ink/60">Cycle</span>
        <ChampSelect
          ariaLabel="Cycle"
          placeholder="Choisir un cycle…"
          className={CHAMP}
          wrapperClassName="w-full sm:w-40"
          value={cycle}
          onChange={(v) => setCycle(v as Cycle | "")}
          options={[
            { value: "prescolaire", label: "Préscolaire" },
            { value: "elementaire", label: "Élémentaire" },
            { value: "college", label: "Collège" },
            { value: "lycee", label: "Lycée" },
          ]}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs sm:w-auto">
        <span className="text-ink/60">Gamme</span>
        <ChampSelect
          ariaLabel="Gamme"
          placeholder="Choisir une gamme…"
          className={CHAMP}
          wrapperClassName="w-full sm:w-40"
          value={gamme}
          onChange={(v) => setGamme(v as Gamme | "")}
          options={GAMMES.map((g) => ({ value: g.value, label: g.label }))}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs sm:w-auto">
        <span className="text-ink/60">Niveau</span>
        <input
          required
          value={niveau}
          onChange={(event) => setNiveau(event.target.value)}
          placeholder="CE2"
          className="min-h-11 w-full rounded-lg border border-ink/15 px-3 text-sm sm:w-28"
        />
      </label>

      <label className="flex flex-1 flex-col gap-1 text-xs">
        <span className="text-ink/60">Nom du kit</span>
        <input
          required
          value={nom}
          onChange={(event) => setNom(event.target.value)}
          placeholder="Kit CE2"
          className="rounded-lg border border-ink/15 min-h-11 px-3 text-sm"
        />
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="rounded-full bg-brand min-h-11 px-4 text-sm font-semibold text-surface active:scale-95 disabled:opacity-50"
      >
        Créer
      </button>

      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </form>
  );
}
