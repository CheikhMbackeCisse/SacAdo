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
  const [erreur, setErreur] = useState<string | null>(null);

  // Commande Wave pas encore payée : le statut est piloté par le webhook, pas
  // par l'admin. On affiche un badge, pas de sélecteur.
  if (statutActuel === "paiement_en_attente") {
    return (
      <span className="inline-flex items-center rounded-full border border-brand/40 bg-brand/5 px-2 py-1 text-xs font-medium text-brand">
        Paiement Wave en attente
      </span>
    );
  }

  const changer = async (nouveauStatut: StatutCommande) => {
    const precedent = valeur;
    setValeur(nouveauStatut);
    setEnCours(true);
    setErreur(null);
    const res = await changerStatutCommande(commandeId, nouveauStatut);
    setEnCours(false);
    if (!res.ok) {
      setValeur(precedent);
      setErreur(res.error);
      return;
    }
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-1">
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
      {erreur && <span className="text-[11px] text-ink/60">{erreur}</span>}
    </div>
  );
}
