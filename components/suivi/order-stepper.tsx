import { Check, TriangleAlert } from "lucide-react";
import type { StatutCommande } from "@/lib/supabase/types";

const ETAPES: { value: StatutCommande; label: string }[] = [
  { value: "recue", label: "Reçue" },
  { value: "preparation", label: "En préparation" },
  { value: "livraison", label: "En livraison" },
  { value: "livree", label: "Livrée" },
];

export function OrderStepper({ statut }: { statut: StatutCommande }) {
  // « Souci » n'est pas une étape du parcours : on affiche un encart dédié.
  // Le suivi reprendra son cours quand l'admin remet un statut normal.
  if (statut === "probleme") {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-3.5">
        <TriangleAlert size={18} className="mt-0.5 shrink-0 text-red-600" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-ink">Souci sur ta commande</p>
          <p className="mt-0.5 text-xs text-ink/65">
            On te contacte par WhatsApp pour trouver une solution. Ton suivi reprend juste après.
          </p>
        </div>
      </div>
    );
  }

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
