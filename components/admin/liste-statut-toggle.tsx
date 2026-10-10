"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { togglerStatutListe } from "@/lib/admin/listes-actions";
import type { StatutListe } from "@/lib/supabase/types";

export function ListeStatutToggle({ listeId, statut }: { listeId: number; statut: StatutListe }) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const publie = statut === "publie";

  return (
    <button
      type="button"
      disabled={enCours}
      onClick={() =>
        demarrer(async () => {
          await togglerStatutListe(listeId, publie ? "masque" : "publie");
          router.refresh();
        })
      }
      className={`rounded-full px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
        publie ? "bg-success/10 text-success" : "bg-ink/10 text-ink/60"
      }`}
    >
      {enCours ? "…" : publie ? "Publié" : "Masqué"}
    </button>
  );
}
