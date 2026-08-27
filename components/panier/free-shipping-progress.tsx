import { formatPrice } from "@/lib/format";

export const SEUIL_GRATUITE = 50000;
// En dessous de ce montant, la barre n'est pas affichée : la relance n'est
// pertinente que lorsque l'objectif devient réellement atteignable.
const SEUIL_AFFICHAGE = 35000;

export function FreeShippingProgress({ sousTotal }: { sousTotal: number }) {
  if (sousTotal <= SEUIL_AFFICHAGE) return null;

  const atteint = sousTotal >= SEUIL_GRATUITE;
  const pourcentage = Math.min((sousTotal / SEUIL_GRATUITE) * 100, 100);

  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-ink/10 bg-elevated p-3">
      <p className={`text-xs font-medium ${atteint ? "text-success" : "text-ink/70"}`}>
        {atteint
          ? "Livraison gratuite débloquée !"
          : `Ajoute ${formatPrice(SEUIL_GRATUITE - sousTotal)} pour la livraison gratuite`}
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
