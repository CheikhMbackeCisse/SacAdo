"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, PackageCheck } from "lucide-react";
import { marquerMaPreparationPrete } from "@/lib/vendeur/preparations-actions";
import { formatDateHeureDakar } from "@/lib/preparations";

export function ConfirmerMaPreparation({
  id,
  statut,
  prepareeLe,
}: {
  id: number;
  statut: "a_preparer" | "preparee";
  prepareeLe: string | null;
}) {
  const router = useRouter();
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, demarrer] = useTransition();

  if (statut === "preparee") {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-[#16A34A]/30 bg-[#16A34A]/10 px-4 py-3 text-sm font-medium text-[#16A34A]">
        <Check size={18} aria-hidden="true" />
        <span>
          Marquée comme préparée
          {prepareeLe && ` le ${formatDateHeureDakar(prepareeLe)}`}.
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() =>
          demarrer(async () => {
            setErreur(null);
            const res = await marquerMaPreparationPrete(id);
            if (!res.ok) {
              setErreur(res.error);
              return;
            }
            router.refresh();
          })
        }
        disabled={envoi}
        className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#0B3D91] px-5 text-sm font-semibold text-[#FEFDFF] active:scale-95 disabled:opacity-50"
      >
        <PackageCheck size={18} aria-hidden="true" />
        {envoi ? "Enregistrement…" : "Commande préparée / prête"}
      </button>
      <p className="text-center text-xs text-[#001314]/50">
        En cliquant, tu confirmes que tout est réuni et prêt à être récupéré.
      </p>
      {erreur && <p className="text-center text-sm text-red-600">{erreur}</p>}
    </div>
  );
}
