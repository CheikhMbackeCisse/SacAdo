import Link from "next/link";
import { XCircle } from "lucide-react";
import { getAjoutParReference } from "@/lib/ajout/actions";
import { formatPrice } from "@/lib/format";
import { BoutonReessayerAjout } from "@/components/ajout/ajout-paiement-retour";

export const dynamic = "force-dynamic";

export default async function AjoutPaiementEchouePage(props: {
  searchParams: Promise<{ ref?: string | string[] }>;
}) {
  const { ref } = await props.searchParams;
  const reference = typeof ref === "string" ? ref : "";
  const ajout = reference ? await getAjoutParReference(reference) : null;

  const rejouable = ajout?.mode_paiement === "wave" && ajout?.statut_paiement !== "payee";

  return (
    <div className="animate-fade-in-up flex flex-col gap-6 px-4 py-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <XCircle size={44} className="text-ink/40" aria-hidden="true" />
        <h1 className="font-heading text-xl font-bold text-ink">Paiement annulé</h1>
        <p className="max-w-sm text-sm text-ink/65">
          Le paiement Wave a été annulé ou n&apos;a pas abouti. Aucun montant n&apos;a été confirmé
          {ajout ? ` pour l'ajout à la commande n°${ajout.commande_id}` : ""}.
        </p>
      </div>

      {ajout && (
        <section className="flex justify-between rounded-2xl border border-ink/10 bg-elevated p-3 text-sm font-semibold text-ink">
          <span>Total à payer</span>
          <span>{formatPrice(ajout.sous_total)}</span>
        </section>
      )}

      {rejouable && ajout?.reference ? <BoutonReessayerAjout reference={ajout.reference} /> : null}

      <Link
        href="/ajout"
        className="flex h-11 items-center justify-center rounded-full border border-ink/15 px-5 text-sm font-medium text-ink"
      >
        Retour à l&apos;ajout
      </Link>
    </div>
  );
}
