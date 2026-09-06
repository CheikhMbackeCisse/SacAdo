"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { supprimerDemandePreparation } from "@/lib/admin/preparations-actions";

export function SupprimerDemandeBouton({ id, reference }: { id: number; reference: string }) {
  const router = useRouter();
  const [confirme, setConfirme] = useState(false);
  const [enCours, setEnCours] = useState(false);

  const supprimer = async () => {
    setEnCours(true);
    await supprimerDemandePreparation(id);
    router.refresh();
  };

  if (confirme) {
    return (
      <span className="flex items-center justify-end gap-1.5 text-xs">
        <button
          type="button"
          onClick={supprimer}
          disabled={enCours}
          className="rounded-lg bg-red-600 px-2 py-1 font-medium text-white disabled:opacity-50"
        >
          Supprimer
        </button>
        <button type="button" onClick={() => setConfirme(false)} className="text-ink/50">
          Annuler
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirme(true)}
      aria-label={`Supprimer la demande ${reference}`}
      className="rounded-lg p-1.5 text-ink/50 hover:bg-red-50 hover:text-red-600"
    >
      <Trash2 size={15} aria-hidden="true" />
    </button>
  );
}
