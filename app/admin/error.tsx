"use client";

import { useEffect } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-red-50 text-red-600">
        <TriangleAlert size={26} aria-hidden="true" />
      </span>
      <h1 className="font-heading text-lg font-semibold text-ink">Erreur admin</h1>
      <p className="max-w-xs text-sm text-ink/60">
        Une erreur est survenue en chargeant cette page (session expirée ou base indisponible).
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
