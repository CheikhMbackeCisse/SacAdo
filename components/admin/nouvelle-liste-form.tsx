"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { creerListe } from "@/lib/admin/listes-actions";

export function NouvelleListeForm() {
  const router = useRouter();
  const [titre, setTitre] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await creerListe({ titre: titre.trim() });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/admin/listes/${result.id}`);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-white p-4 sm:flex-row sm:items-end"
    >
      <label className="flex flex-1 flex-col gap-1 text-xs">
        <span className="text-ink/60">Titre de la liste</span>
        <input
          required
          value={titre}
          onChange={(event) => setTitre(event.target.value)}
          placeholder="Fournitures 4e"
          className="min-h-11 rounded-lg border border-ink/15 px-3 text-sm"
        />
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="min-h-11 rounded-full bg-brand px-4 text-sm font-semibold text-surface active:scale-95 disabled:opacity-50"
      >
        Créer
      </button>

      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </form>
  );
}
