"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { basculerCommandeTest } from "@/lib/admin/commandes-actions";

// PROMPT_ADMIN_COMPTA_LOCALITES.md Lot 1 §5 : interrupteur réservé à l'admin
// pour qu'un futur test ne fausse plus la comptabilité ni les statistiques.
export function CommandeTestToggle({ commandeId, estTest }: { commandeId: number; estTest: boolean }) {
  const router = useRouter();
  const [valeur, setValeur] = useState(estTest);
  const [enCours, setEnCours] = useState(false);

  const basculer = async () => {
    const precedent = valeur;
    setValeur(!precedent);
    setEnCours(true);
    const res = await basculerCommandeTest(commandeId, !precedent);
    setEnCours(false);
    if (!res.ok) {
      setValeur(precedent);
      return;
    }
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={basculer}
      disabled={enCours}
      className={`rounded-full border px-2 py-1 text-xs font-medium ${
        valeur ? "border-brand bg-brand/10 text-brand" : "border-ink/15 text-ink/50"
      }`}
    >
      {valeur ? "Commande de test" : "Marquer comme test"}
    </button>
  );
}
