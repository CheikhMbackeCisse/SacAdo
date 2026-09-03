import Link from "next/link";
import { formatPrice } from "@/lib/format";
import { waveEnModeSimulation } from "@/lib/wave/client";
import { SimulationBoutons } from "@/components/checkout/paiement-retour";

export const dynamic = "force-dynamic";

// Page de SIMULATION du paiement Wave, active uniquement tant que WAVE_API_KEY
// n'est pas configurée (voir lib/wave/client.ts). Elle remplace la vraie page
// de paiement Wave pour dérouler le parcours de checkout de bout en bout en
// dev. En production avec les vraies clés, elle est inaccessible.
export default async function SimulationPaiementPage(props: {
  searchParams: Promise<{ ref?: string | string[]; montant?: string | string[] }>;
}) {
  const { ref, montant } = await props.searchParams;
  const reference = typeof ref === "string" ? ref : "";

  if (!waveEnModeSimulation() || !reference) {
    return (
      <div className="flex flex-col items-center gap-4 px-4 py-16 text-center">
        <h1 className="font-heading text-xl font-bold text-ink">Page indisponible</h1>
        <Link
          href="/panier"
          className="flex h-11 items-center justify-center rounded-full border border-ink/15 px-5 text-sm font-medium text-ink"
        >
          Retour au panier
        </Link>
      </div>
    );
  }

  const montantNum = Number(montant);

  return (
    <div className="animate-fade-in-up mx-auto flex max-w-sm flex-col gap-6 px-4 py-12">
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="rounded-full bg-decorative/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-ink/60">
          Simulation
        </span>
        <h1 className="font-heading text-xl font-bold text-ink">Paiement Wave</h1>
        <p className="text-sm text-ink/60">
          Environnement de test — aucun paiement réel. Choisis l&apos;issue à simuler.
        </p>
        {Number.isFinite(montantNum) && montantNum > 0 && (
          <p className="mt-1 text-lg font-bold text-ink">{formatPrice(montantNum)}</p>
        )}
      </div>

      <SimulationBoutons reference={reference} />
    </div>
  );
}
