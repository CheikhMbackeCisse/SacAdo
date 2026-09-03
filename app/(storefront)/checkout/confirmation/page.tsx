import Link from "next/link";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { getCommandeParReference } from "@/lib/checkout/actions";
import { formatPrice } from "@/lib/format";
import { ViderPanierAuMontage } from "@/components/checkout/paiement-retour";

export const dynamic = "force-dynamic";

export default async function ConfirmationPaiementPage(props: {
  searchParams: Promise<{ ref?: string | string[] }>;
}) {
  const { ref } = await props.searchParams;
  const reference = typeof ref === "string" ? ref : "";
  const commande = reference ? await getCommandeParReference(reference) : null;

  if (!commande) {
    return (
      <div className="animate-fade-in-up flex flex-col items-center gap-4 px-4 py-16 text-center">
        <XCircle size={44} className="text-ink/30" aria-hidden="true" />
        <h1 className="font-heading text-xl font-bold text-ink">Commande introuvable</h1>
        <p className="max-w-xs text-sm text-ink/60">
          Nous ne retrouvons pas cette commande. Si tu as été débité, contacte-nous depuis
          l&apos;assistance.
        </p>
        <Link
          href="/panier"
          className="mt-2 flex h-11 items-center justify-center rounded-full border border-ink/15 px-5 text-sm font-medium text-ink"
        >
          Retour au panier
        </Link>
      </div>
    );
  }

  const paye = commande.statut_paiement === "payee";
  const echoue = commande.statut_paiement === "echoue" || commande.statut_paiement === "annulee";

  return (
    <div className="animate-fade-in-up flex flex-col gap-6 px-4 py-10">
      <ViderPanierAuMontage />

      <div className="flex flex-col items-center gap-3 text-center">
        {paye ? (
          <CheckCircle2 size={44} className="text-success" aria-hidden="true" />
        ) : echoue ? (
          <XCircle size={44} className="text-ink/40" aria-hidden="true" />
        ) : (
          <Clock size={44} className="text-brand" aria-hidden="true" />
        )}

        <h1 className="font-heading text-xl font-bold text-ink">
          {paye
            ? "Paiement confirmé"
            : echoue
              ? "Paiement non abouti"
              : "Paiement bien reçu"}
        </h1>

        <p className="max-w-sm text-sm text-ink/65">
          {paye
            ? `Ta commande #${commande.id} est confirmée et entre en préparation.`
            : echoue
              ? "Ton paiement n'a pas pu être confirmé. Tu peux réessayer depuis le suivi de ta commande."
              : `On attend la confirmation de paiement de Wave pour la commande #${commande.id}. Dès qu'elle arrive, ta commande démarre — tu seras prévenu dans ta boîte de réception.`}
        </p>
      </div>

      <section className="flex flex-col gap-1.5 rounded-2xl border border-ink/10 bg-elevated p-3 text-sm">
        <div className="flex justify-between text-ink/70">
          <span>Sous-total</span>
          <span>{formatPrice(commande.sous_total)}</span>
        </div>
        <div className="flex justify-between text-ink/70">
          <span>Livraison ({commande.mode_livraison})</span>
          <span>
            {commande.frais_livraison === 0 ? "Gratuite" : formatPrice(commande.frais_livraison)}
          </span>
        </div>
        <div className="flex justify-between border-t border-ink/10 pt-1.5 font-semibold text-ink">
          <span>Total</span>
          <span>{formatPrice(commande.total)}</span>
        </div>
      </section>

      <Link
        href={`/suivi/${commande.id}`}
        className="flex h-12 items-center justify-center rounded-full bg-brand text-sm font-semibold text-on-brand"
      >
        Suivre ma commande
      </Link>
    </div>
  );
}
