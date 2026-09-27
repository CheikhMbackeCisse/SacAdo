"use client";

import { useEffect, useState } from "react";
import { formatPrice } from "@/lib/format";
import { getSeuilLivraisonGratuite } from "@/lib/supabase/queries";

// En dessous de ce montant, la barre n'est pas affichée : la relance n'est
// pertinente que lorsque l'objectif devient réellement atteignable.
const SEUIL_AFFICHAGE = 35000;

export function FreeShippingProgress({ sousTotal }: { sousTotal: number }) {
  // null tant que la vraie valeur n'est pas arrivée (table `parametres`,
  // réglable en admin — IMPLEMENTATION_TARIFS_LIVRAISON.md §5) : la barre
  // reste cachée par défaut plutôt que d'apparaître puis disparaître si la
  // livraison gratuite est désactivée (CORRECTIONS_V11 lot 1).
  const [seuil, setSeuil] = useState<number | null>(null);
  useEffect(() => {
    getSeuilLivraisonGratuite().then(setSeuil);
  }, []);

  if (seuil === null) return null;
  if (sousTotal <= SEUIL_AFFICHAGE) return null;

  const atteint = sousTotal >= seuil;
  const pourcentage = Math.min((sousTotal / seuil) * 100, 100);

  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-ink/10 bg-elevated p-3">
      <p className={`text-xs font-medium ${atteint ? "text-success" : "text-ink/70"}`}>
        {atteint
          ? "Livraison gratuite débloquée !"
          : `Ajoute ${formatPrice(seuil - sousTotal)} pour la livraison gratuite`}
      </p>
      <div className="h-2 w-full overflow-hidden rounded-full bg-ink/10">
        <div
          className={`h-full rounded-full transition-all ${atteint ? "bg-success" : "bg-action"}`}
          style={{ width: `${pourcentage}%` }}
        />
      </div>
    </div>
  );
}
