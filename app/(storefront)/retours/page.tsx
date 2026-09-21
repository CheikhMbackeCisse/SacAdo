import { WHATSAPP_AFFICHE } from "@/lib/whatsapp";
import { EDITEUR } from "@/lib/legal";

export const metadata = { title: "Retours et remboursements — SacAdo" };

export default function RetoursPage() {
  return (
    <div className="animate-fade-in-up flex flex-col gap-6 px-4 py-6">
      <div>
        <h1 className="font-heading text-xl font-bold text-ink">Retours et remboursements</h1>
        <p className="mt-1 text-xs text-ink/50">Dernière mise à jour : 2026.</p>
      </div>

      <section className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-elevated p-4">
        <h2 className="text-sm font-semibold text-ink">Signalement</h2>
        <p className="text-sm text-ink/70">
          Tout problème doit être signalé dans les 24 heures suivant la réception, par WhatsApp
          au {WHATSAPP_AFFICHE} ou par e-mail à {EDITEUR.email}, avec une photo du produit
          concerné.
        </p>
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-elevated p-4">
        <h2 className="text-sm font-semibold text-ink">Cas acceptés</h2>
        <p className="text-sm text-ink/70">
          Produit défectueux, produit différent de la commande, produit endommagé à la livraison.
        </p>
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-elevated p-4">
        <h2 className="text-sm font-semibold text-ink">Cas exclus</h2>
        <p className="text-sm text-ink/70">Produit utilisé, ou endommagé après la livraison.</p>
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-elevated p-4">
        <h2 className="text-sm font-semibold text-ink">Remboursement</h2>
        <p className="text-sm text-ink/70">
          Les conditions et le délai de remboursement dépendent de la catégorie du produit
          acheté. Ils sont précisés lors de la prise en charge de la réclamation. Tout
          remboursement est effectué par Wave, sur le numéro ayant servi au paiement.
        </p>
      </section>
    </div>
  );
}
