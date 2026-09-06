"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Truck } from "lucide-react";
import { marquerDemandeRecuperee } from "@/lib/admin/preparations-actions";
import { formatDateHeureDakar } from "@/lib/preparations";

export function MarquerRecupereeBouton({
  id,
  recupereeLe,
}: {
  id: number;
  recupereeLe: string | null;
}) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();

  if (recupereeLe) {
    return (
      <p className="flex items-center gap-1.5 text-sm text-success">
        <Check size={16} aria-hidden="true" />
        Récupérée le {formatDateHeureDakar(recupereeLe)}
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={() => demarrer(async () => {
        await marquerDemandeRecuperee(id);
        router.refresh();
      })}
      disabled={enCours}
      className="flex min-h-11 items-center gap-1.5 rounded-full border border-ink/15 px-4 text-sm font-medium text-ink/80 hover:border-brand hover:text-brand disabled:opacity-50"
    >
      <Truck size={15} aria-hidden="true" />
      {enCours ? "Enregistrement…" : "Marquer comme récupérée"}
    </button>
  );
}
