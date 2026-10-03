"use client";

import { useRouter } from "next/navigation";
import { PlusCircle } from "lucide-react";
import { useAjoutMode } from "@/lib/local/ajout-mode";

// "Ajouter des produits à cette commande" (PROMPT_CLIENT_V2 Lot 4) : ouvre la
// boutique en mode ajout. Affiché par l'appelant seulement quand
// commandeModifiablePourAjout(commande.statut) est vrai.
export function BoutonAjouterProduits({
  commandeId,
  jeton,
  className,
}: {
  commandeId: number;
  jeton: string;
  className?: string;
}) {
  const router = useRouter();
  const { entrer } = useAjoutMode();

  return (
    <button
      type="button"
      onClick={() => {
        entrer(commandeId, jeton);
        router.push("/");
      }}
      className={
        className ??
        "flex h-11 items-center justify-center gap-1.5 rounded-full border border-brand/30 bg-brand/5 px-4 text-sm font-semibold text-brand transition-transform active:scale-[0.98]"
      }
    >
      <PlusCircle size={16} aria-hidden="true" />
      Ajouter des produits à cette commande
    </button>
  );
}
