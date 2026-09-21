import Link from "next/link";
import { EDITEUR } from "@/lib/legal";
import { WHATSAPP_AFFICHE } from "@/lib/whatsapp";
import { SEUIL_PAIEMENT_AVANCE } from "@/lib/checkout/montants";
import { formatPrice } from "@/lib/format";

export const metadata = { title: "Conditions générales de vente — SacAdo" };

export default function CgvPage() {
  return (
    <div className="animate-fade-in-up flex flex-col gap-6 px-4 py-6">
      <div>
        <h1 className="font-heading text-xl font-bold text-ink">Conditions générales de vente</h1>
        <p className="mt-1 text-xs text-ink/50">Dernière mise à jour : 2026.</p>
      </div>

      <section className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-elevated p-4">
        <h2 className="text-sm font-semibold text-ink">1. Objet et identification</h2>
        <p className="text-sm text-ink/70">
          Les présentes conditions régissent les ventes réalisées sur SacAdo, service édité et
          exploité par {EDITEUR.raisonSociale}. Toute commande passée sur SacAdo implique
          l&apos;acceptation pleine et entière de ces conditions.
        </p>
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-elevated p-4">
        <h2 className="text-sm font-semibold text-ink">2. Produits</h2>
        <p className="text-sm text-ink/70">
          Les produits sont décrits et photographiés avec le plus grand soin. Les photographies
          sont non contractuelles. La disponibilité d&apos;un produit est décidée par le vendeur
          qui le propose.
        </p>
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-elevated p-4">
        <h2 className="text-sm font-semibold text-ink">3. Prix</h2>
        <p className="text-sm text-ink/70">
          Les prix sont indiqués en francs CFA (FCFA), toutes taxes comprises. Les frais de
          livraison sont indiqués avant la validation de la commande.
        </p>
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-elevated p-4">
        <h2 className="text-sm font-semibold text-ink">4. Commande</h2>
        <p className="text-sm text-ink/70">
          La commande se passe en choisissant des produits, en renseignant les coordonnées de
          livraison, puis en confirmant. Une confirmation est envoyée par WhatsApp.
        </p>
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-elevated p-4">
        <h2 className="text-sm font-semibold text-ink">5. Paiement</h2>
        <p className="text-sm text-ink/70">
          Au-delà de {formatPrice(SEUIL_PAIEMENT_AVANCE)}, le paiement se règle d&apos;avance par
          Wave. En dessous de ce seuil, le paiement à la livraison reste possible. Le bénéficiaire
          affiché sur l&apos;écran Wave est {EDITEUR.raisonSociale}.
        </p>
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-elevated p-4">
        <h2 className="text-sm font-semibold text-ink">6. Livraison</h2>
        <p className="text-sm text-ink/70">
          La livraison se fait partout au Sénégal, en moins de 6 jours selon le mode choisi.
        </p>
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-elevated p-4">
        <h2 className="text-sm font-semibold text-ink">7. Garantie</h2>
        <p className="text-sm text-ink/70">
          Le matériel informatique reconditionné bénéficie d&apos;une garantie de 6 mois. Les
          autres produits bénéficient de la garantie légale applicable.
        </p>
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-elevated p-4">
        <h2 className="text-sm font-semibold text-ink">8. Retours et remboursements</h2>
        <p className="text-sm text-ink/70">
          Tout problème doit être signalé sous 24 heures suivant la réception. Les conditions et
          le délai de remboursement dépendent de la catégorie du produit acheté. Voir la page{" "}
          <Link href="/retours" className="font-medium text-brand">
            Retours et remboursements
          </Link>
          .
        </p>
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-elevated p-4">
        <h2 className="text-sm font-semibold text-ink">9. Réclamations et contact</h2>
        <p className="text-sm text-ink/70">
          Pour toute réclamation, contacter SacAdo par WhatsApp au {WHATSAPP_AFFICHE} ou par
          e-mail à {EDITEUR.email}.
        </p>
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-elevated p-4">
        <h2 className="text-sm font-semibold text-ink">10. Droit applicable</h2>
        <p className="text-sm text-ink/70">Les présentes conditions sont soumises au droit sénégalais.</p>
      </section>
    </div>
  );
}
