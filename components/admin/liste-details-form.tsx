"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { modifierListe } from "@/lib/admin/listes-actions";

export function ListeDetailsForm({
  listeId,
  titre,
  description,
}: {
  listeId: number;
  titre: string;
  description: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const enregistrer = async (patch: { titre?: string; description?: string | null }) => {
    setError(null);
    const result = await modifierListe(listeId, patch);
    if (!result.ok) setError(result.error);
    router.refresh();
  };

  return (
    <div className="flex max-w-2xl flex-col gap-3 rounded-2xl border border-ink/10 bg-white p-4">
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-ink/60">Titre</span>
        <input
          defaultValue={titre}
          onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== titre && enregistrer({ titre: e.target.value })}
          className="min-h-11 rounded-lg border border-ink/15 px-3 text-sm font-semibold text-ink"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-ink/60">Description (optionnelle, affichée sur la page publique)</span>
        <textarea
          defaultValue={description ?? ""}
          onBlur={(e) => enregistrer({ description: e.target.value })}
          rows={2}
          className="rounded-lg border border-ink/15 px-3 py-2 text-sm"
        />
      </label>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
