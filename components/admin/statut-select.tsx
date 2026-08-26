"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { changerStatutCommande } from "@/lib/admin/commandes-actions";
import type { StatutCommande } from "@/lib/supabase/types";

const OPTIONS: { value: StatutCommande; label: string }[] = [
  { value: "recue", label: "Reçue" },
  { value: "preparation", label: "En préparation" },
  { value: "livraison", label: "En livraison" },
  { value: "livree", label: "Livrée" },
];

export function StatutSelect({
  commandeId,
  statutActuel,
}: {
  commandeId: number;
  statutActuel: StatutCommande;
}) {
  const router = useRouter();
  const [valeur, setValeur] = useState(statutActuel);
  const [enCours, setEnCours] = useState(false);

  const changer = async (nouveauStatut: StatutCommande) => {
    setValeur(nouveauStatut);
    setEnCours(true);
    await changerStatutCommande(commandeId, nouveauStatut);
    setEnCours(false);
    router.refresh();
  };

  return (
    <select
      value={valeur}
      disabled={enCours}
      onChange={(event) => changer(event.target.value as StatutCommande)}
      className={`rounded-full border px-2 py-1 text-xs font-medium ${
        valeur === "livree" ? "border-success/40 text-success" : "border-ink/15 text-ink/70"
      }`}
    >
      {OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
