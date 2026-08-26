"use client";

import { useEffect } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";

// Filet de sécurité si une page plante (ex: Supabase momentanément
// indisponible) : un message clair plutôt qu'un écran blanc.
export default function StorefrontError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-ink/5 text-ink/50">
        <TriangleAlert size={26} aria-hidden="true" />
      </span>
      <h1 className="font-heading text-lg font-semibold text-ink">Un souci est survenu</h1>
      <p className="max-w-xs text-sm text-ink/60">
        Le site rencontre une difficulté temporaire. Réessaie dans un instant.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-2 flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-surface active:scale-95"
      >
        <RefreshCw size={16} aria-hidden="true" />
        Réessayer
      </button>
    </div>
  );
}
