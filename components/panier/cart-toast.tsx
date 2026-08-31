"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import {
  EVENEMENT_PANIER_AJOUT,
  type DetailAjoutPanier,
} from "@/lib/local/panier";

// Durée d'affichage avant disparition automatique. La barre ne bloque pas la
// navigation : elle se ferme aussi au clic sur « Voir mon panier » ou sur la
// croix, et un nouvel ajout relance le compte à rebours.
const DUREE_MS = 4000;

type EtatToast = { total: number; cle: number };

export function CartToast() {
  const [toast, setToast] = useState<EtatToast | null>(null);
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onAjout = (event: Event) => {
      const detail = (event as CustomEvent<DetailAjoutPanier>).detail;
      setToast({ total: detail?.totalArticles ?? 0, cle: Date.now() });
      if (minuterie.current) clearTimeout(minuterie.current);
      minuterie.current = setTimeout(() => setToast(null), DUREE_MS);
    };

    window.addEventListener(EVENEMENT_PANIER_AJOUT, onAjout);
    return () => {
      window.removeEventListener(EVENEMENT_PANIER_AJOUT, onAjout);
      if (minuterie.current) clearTimeout(minuterie.current);
    };
  }, []);

  if (!toast) return null;

  const fermer = () => {
    if (minuterie.current) clearTimeout(minuterie.current);
    setToast(null);
  };

  return (
    <div
      className="fixed inset-x-0 top-0 z-[60] flex justify-center px-3 pt-[calc(0.5rem+env(safe-area-inset-top))]"
      role="status"
      aria-live="polite"
    >
      <div
        key={toast.cle}
        className="animate-toast-in flex w-full max-w-md items-center gap-3 rounded-2xl border border-brand/15 bg-elevated px-4 py-3 shadow-lg"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
          <Check size={18} aria-hidden="true" />
        </span>

        <p className="min-w-0 flex-1 text-sm text-ink">
          Vous avez ajouté {toast.total} article{toast.total > 1 ? "s" : ""} à votre
          panier.
        </p>

        <Link
          href="/panier"
          onClick={fermer}
          className="shrink-0 rounded-full bg-action px-3 py-1.5 text-xs font-semibold text-on-action transition-transform active:scale-95"
        >
          Voir mon panier
        </Link>

        <button
          type="button"
          onClick={fermer}
          aria-label="Fermer"
          className="shrink-0 rounded-full p-1 text-ink/40 transition-colors hover:bg-ink/5 hover:text-ink"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
