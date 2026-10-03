import Link from "next/link";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { getAjoutParReference } from "@/lib/ajout/actions";
import { formatPrice } from "@/lib/format";
import { ViderPanierAjoutAuMontage } from "@/components/ajout/ajout-paiement-retour";

export const dynamic = "force-dynamic";

export default async function AjoutConfirmationPage(props: {
  searchParams: Promise<{ ref?: string | string[] }>;
}) {
  const { ref } = await props.searchParams;
  const reference = typeof ref === "string" ? ref : "";
  const ajout = reference ? await getAjoutParReference(reference) : null;

  if (!ajout) {
    return (
      <div className="animate-fade-in-up flex flex-col items-center gap-4 px-4 py-16 text-center">
        <XCircle size={44} className="text-ink/30" aria-hidden="true" />
        <h1 className="font-heading text-xl font-bold text-ink">Ajout introuvable</h1>
        <p className="max-w-xs text-sm text-ink/60">
          Nous ne retrouvons pas cet ajout. Si tu as été débité, contacte-nous depuis l&apos;assistance.
        </p>
      </div>
    );
  }

  const paye = ajout.statut_paiement === "payee";
  const echoue = ajout.statut_paiement === "echoue";

  return (
    <div className="animate-fade-in-up flex flex-col gap-6 px-4 py-10">
      <ViderPanierAjoutAuMontage />

      <div className="flex flex-col items-center gap-3 text-center">
        {paye ? (
          <CheckCircle2 size={44} className="text-success" aria-hidden="true" />
        ) : echoue ? (
          <XCircle size={44} className="text-ink/40" aria-hidden="true" />
        ) : (
          <Clock size={44} className="text-brand" aria-hidden="true" />
        )}

        <h1 className="font-heading text-xl font-bold text-ink">
          {paye ? "Paiement confirmé" : echoue ? "Paiement non abouti" : "Paiement bien reçu"}
        </h1>

        <p className="max-w-sm text-sm text-ink/65">
          {paye
            ? `Tes articles ajoutés à la commande n°${ajout.commande_id} sont confirmés.`
            : echoue
              ? "Ton paiement n'a pas pu être confirmé. Tu peux réessayer depuis le suivi de ta commande."
              : `On attend la confirmation de paiement de Wave pour cet ajout à la commande n°${ajout.commande_id}. Dès qu'elle arrive, tu seras prévenu dans ta boîte de réception.`}
        </p>
      </div>

      <section className="flex justify-between rounded-2xl border border-ink/10 bg-elevated p-3 text-sm font-semibold text-ink">
        <span>Total de l&apos;ajout</span>
        <span>{formatPrice(ajout.sous_total)}</span>
      </section>

      <Link
        href="/commandes"
        className="flex h-12 items-center justify-center rounded-full bg-brand text-sm font-semibold text-on-brand"
      >
        Mes commandes
      </Link>
    </div>
  );
}
