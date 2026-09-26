"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { togglerStatutKit } from "@/lib/admin/kits-actions";
import type { StatutKit } from "@/lib/supabase/types";

export function KitStatutToggle({ kitId, statut }: { kitId: number; statut: StatutKit }) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const publie = statut === "publie";

  return (
    <button
      type="button"
      disabled={enCours}
      onClick={() =>
        demarrer(async () => {
          await togglerStatutKit(kitId, publie ? "masque" : "publie");
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
