import { notFound } from "next/navigation";
import { Package } from "lucide-react";
import { getCycleByValue } from "@/lib/cycles";
import { getKitByCycleNiveau, getKitItemsAvecProduits } from "@/lib/supabase/queries";
import { KitBuilder } from "@/components/kits/kit-builder";

// ISR : le contenu d'un kit (cycle+niveau) change rarement, pas besoin de
// retaper Supabase à chaque visite.
export const revalidate = 120;

export default async function KitPage(props: PageProps<"/kits/[cycle]/[niveau]">) {
  const { cycle, niveau: niveauParam } = await props.params;
  const niveau = decodeURIComponent(niveauParam);
  const cycleDef = getCycleByValue(cycle);
  if (!cycleDef || !cycleDef.classes.includes(niveau)) notFound();

  const kit = await getKitByCycleNiveau(cycle, niveau);

  if (!kit) {
    return (
      <div className="animate-fade-in-up flex flex-1 flex-col items-center justify-center gap-3 px-6 py-24 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-brand/10 text-brand">
          <Package size={26} aria-hidden="true" />
        </span>
        <h1 className="font-heading text-lg font-semibold text-ink">
          Kit {niveau} bientôt disponible
        </h1>
        <p className="max-w-xs text-sm text-ink/60">
          Ce kit n&apos;a pas encore été composé pour le niveau {niveau} ({cycleDef.label}).
        </p>
      </div>
    );
  }

  const items = await getKitItemsAvecProduits(kit.id);

  return (
    <div className="animate-fade-in-up flex flex-col gap-1 py-4">
      <h1 className="px-4 pb-1 font-heading text-xl font-bold text-ink">{kit.nom}</h1>
      <p className="px-4 pb-3 text-sm text-ink/60">
        Liste pré-cochée : décoche ce que tu as déjà, ajuste les quantités.
      </p>
      <KitBuilder kitNom={kit.nom} items={items} />
    </div>
  );
}
