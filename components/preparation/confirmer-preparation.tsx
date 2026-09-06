"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, PackageCheck } from "lucide-react";
import { marquerPreparationPrete } from "@/lib/preparation-public-actions";
import { formatDateHeureDakar } from "@/lib/preparations";

export function ConfirmerPreparation({
  demandeId,
  jeton,
  statut,
  prepareeLe,
}: {
  demandeId: number;
  jeton: string;
  statut: "a_preparer" | "preparee";
  prepareeLe: string | null;
}) {
  const router = useRouter();
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, demarrer] = useTransition();

  if (statut === "preparee") {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-success/30 bg-success/10 px-4 py-3 text-sm font-medium text-success">
        <Check size={18} aria-hidden="true" />
        <span>
          Marquée comme préparée
          {prepareeLe && ` le ${formatDateHeureDakar(prepareeLe)}`}.
        </span>
      </div>
    );
  }

  const confirmer = () => {
    setErreur(null);
    demarrer(async () => {
      const res = await marquerPreparationPrete(demandeId, jeton);
      if (!res.ok) {
        setErreur(res.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={confirmer}
        disabled={envoi}
        className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand px-5 text-sm font-semibold text-on-brand active:scale-95 disabled:opacity-50"
      >
        <PackageCheck size={18} aria-hidden="true" />
        {envoi ? "Enregistrement…" : "Commande préparée / prête"}
      </button>
      <p className="text-center text-xs text-ink/50">
        En cliquant, tu confirmes que tout est réuni et prêt à être récupéré.
      </p>
      {erreur && <p className="text-center text-sm text-red-600">{erreur}</p>}
    </div>
  );
}
