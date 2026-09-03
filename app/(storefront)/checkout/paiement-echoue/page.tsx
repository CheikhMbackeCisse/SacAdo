import Link from "next/link";
import { XCircle } from "lucide-react";
import { getCommandeParReference } from "@/lib/checkout/actions";
import { formatPrice } from "@/lib/format";
import { BoutonReessayerPaiement } from "@/components/checkout/paiement-retour";

export const dynamic = "force-dynamic";

export default async function PaiementEchouePage(props: {
  searchParams: Promise<{ ref?: string | string[] }>;
}) {
  const { ref } = await props.searchParams;
  const reference = typeof ref === "string" ? ref : "";
  const commande = reference ? await getCommandeParReference(reference) : null;

  const rejouable =
    commande?.mode_paiement === "wave" && commande?.statut === "paiement_en_attente";

  return (
    <div className="animate-fade-in-up flex flex-col gap-6 px-4 py-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <XCircle size={44} className="text-ink/40" aria-hidden="true" />
        <h1 className="font-heading text-xl font-bold text-ink">Paiement annulé</h1>
        <p className="max-w-sm text-sm text-ink/65">
          Le paiement Wave a été annulé ou n&apos;a pas abouti. Aucun montant n&apos;a été
          confirmé
          {commande ? ` pour la commande #${commande.id}` : ""}.
        </p>
      </div>

      {commande && (
        <section className="flex justify-between rounded-2xl border border-ink/10 bg-elevated p-3 text-sm font-semibold text-ink">
          <span>Total à payer</span>
          <span>{formatPrice(commande.total)}</span>
        </section>
      )}

      {rejouable && commande?.client_reference ? (
        <BoutonReessayerPaiement reference={commande.client_reference} />
      ) : null}

      <Link
        href="/panier"
        className="flex h-11 items-center justify-center rounded-full border border-ink/15 px-5 text-sm font-medium text-ink"
      >
        Retour au panier
      </Link>
    </div>
  );
}
