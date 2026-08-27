"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { creerKit } from "@/lib/admin/kits-actions";
import { GAMMES } from "@/lib/gammes";
import type { Cycle, Gamme } from "@/lib/supabase/types";

export function NouveauKitForm() {
  const router = useRouter();
  const [cycle, setCycle] = useState<Cycle>("elementaire");
  const [gamme, setGamme] = useState<Gamme>("essentiel");
  const [niveau, setNiveau] = useState("");
  const [nom, setNom] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
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
      className="flex flex-wrap items-end gap-3 rounded-2xl border border-ink/10 bg-white p-4"
    >
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-ink/60">Cycle</span>
        <select
          value={cycle}
          onChange={(event) => setCycle(event.target.value as Cycle)}
          className="rounded-lg border border-ink/15 px-2 py-1.5 text-sm"
        >
          <option value="prescolaire">Préscolaire</option>
          <option value="elementaire">Élémentaire</option>
          <option value="college">Collège</option>
          <option value="lycee">Lycée</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs">
        <span className="text-ink/60">Gamme</span>
        <select
          value={gamme}
          onChange={(event) => setGamme(event.target.value as Gamme)}
          className="rounded-lg border border-ink/15 px-2 py-1.5 text-sm"
        >
          {GAMMES.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs">
        <span className="text-ink/60">Niveau</span>
        <input
          required
          value={niveau}
          onChange={(event) => setNiveau(event.target.value)}
          placeholder="CE2"
          className="w-28 rounded-lg border border-ink/15 px-2 py-1.5 text-sm"
        />
      </label>

      <label className="flex flex-1 flex-col gap-1 text-xs">
        <span className="text-ink/60">Nom du kit</span>
        <input
          required
          value={nom}
          onChange={(event) => setNom(event.target.value)}
          placeholder="Kit CE2"
          className="rounded-lg border border-ink/15 px-2 py-1.5 text-sm"
        />
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-surface active:scale-95 disabled:opacity-50"
      >
        Créer
      </button>

      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </form>
  );
}
