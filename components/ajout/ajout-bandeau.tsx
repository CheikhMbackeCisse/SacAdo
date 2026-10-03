"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { useAjoutMode } from "@/lib/local/ajout-mode";

// Bannière persistante pendant un ajout à une commande (PROMPT_CLIENT_V2
// Lot 4) : rendue dans le layout, visible sur toute la boutique tant que le
// mode est actif, pour que le client sache en permanence qu'il n'est pas en
// train de passer une nouvelle commande.
export function AjoutBandeau() {
  const { mode, sortir } = useAjoutMode();
  if (!mode) return null;

  return (
    <div
      role="status"
      className="sticky top-0 z-40 flex items-center justify-between gap-2 bg-brand px-4 py-2 text-xs font-medium text-on-brand"
    >
      <span className="min-w-0 truncate">
        Ajout à la commande n°{mode.commandeId} · livraison déjà comptée ·{" "}
        <Link href="/ajout" className="underline underline-offset-2">
          Terminer
        </Link>
      </span>
      <button
        type="button"
        onClick={sortir}
        aria-label="Annuler l'ajout"
        className="flex size-6 shrink-0 items-center justify-center rounded-full text-on-brand/80 active:scale-90"
      >
        <X size={15} aria-hidden="true" />
      </button>
    </div>
  );
}
