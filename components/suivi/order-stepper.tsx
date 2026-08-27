import { Check } from "lucide-react";
import type { StatutCommande } from "@/lib/supabase/types";

const ETAPES: { value: StatutCommande; label: string }[] = [
  { value: "recue", label: "Reçue" },
  { value: "preparation", label: "En préparation" },
  { value: "livraison", label: "En livraison" },
  { value: "livree", label: "Livrée" },
];

export function OrderStepper({ statut }: { statut: StatutCommande }) {
  const indexActuel = ETAPES.findIndex((e) => e.value === statut);

  return (
    <ol className="flex flex-col">
      {ETAPES.map((etape, index) => {
        const atteinte = index <= indexActuel;
        const estLivree = etape.value === "livree" && atteinte;
        const dernier = index === ETAPES.length - 1;

        return (
          <li key={etape.value} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  estLivree
                    ? "bg-success text-on-brand"
                    : atteinte
                      ? "bg-brand text-on-brand"
                      : "bg-ink/10 text-ink/40"
                }`}
              >
                {atteinte ? <Check size={14} aria-hidden="true" /> : index + 1}
              </span>
              {!dernier && (
                <span
                  className={`w-0.5 flex-1 ${atteinte ? "bg-brand" : "bg-ink/10"}`}
                  style={{ minHeight: 24 }}
                  aria-hidden="true"
                />
              )}
            </div>
            <span
              className={`pb-6 text-sm ${
                estLivree ? "font-semibold text-success" : atteinte ? "font-medium text-ink" : "text-ink/40"
              }`}
            >
              {etape.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
