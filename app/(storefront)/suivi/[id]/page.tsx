import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { formatPrice } from "@/lib/format";
import { OrderStepper } from "@/components/suivi/order-stepper";
import { CommandeLocalisation } from "@/components/checkout/commande-localisation";
import type { Commande } from "@/lib/supabase/types";

export default async function SuiviPage(props: PageProps<"/suivi/[id]">) {
  const { id } = await props.params;
  const commandeId = Number(id);
  if (!Number.isFinite(commandeId)) notFound();

  // Lecture via service_role : commandes n'a aucune policy publique (données
  // client), donc on ne peut la lire que depuis un composant serveur.
  const { data: commande, error } = await supabaseAdmin
    .from("commandes")
    .select("*")
    .eq("id", commandeId)
    .maybeSingle<Commande>();

  if (error || !commande) notFound();

  const enAttentePaiement = commande.statut === "paiement_en_attente";

  return (
    <div className="animate-fade-in-up flex flex-col gap-6 px-4 py-6">
      <div>
        <h1 className="font-heading text-xl font-bold text-ink">Commande #{commande.id}</h1>
        <p className="text-sm text-ink/60">
          {enAttentePaiement
            ? "Paiement Wave non finalisé."
            : "Merci ! Ta commande a bien été reçue."}
        </p>
      </div>

      {enAttentePaiement && commande.client_reference && (
        <div className="flex flex-col gap-3 rounded-2xl border border-brand/30 bg-brand/5 p-3">
          <p className="text-sm text-ink/75">
            Cette commande n&apos;est pas encore confirmée : le paiement Wave n&apos;a pas
            abouti. Tu peux le reprendre maintenant.
          </p>
          <Link
            href={`/checkout/paiement-echoue?ref=${encodeURIComponent(commande.client_reference)}`}
            className="flex h-11 items-center justify-center rounded-full bg-action text-sm font-semibold text-on-action"
          >
            Reprendre le paiement
          </Link>
        </div>
      )}

      <OrderStepper statut={commande.statut} />

      {commande.lat != null && commande.lng != null && (
        <section className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-elevated p-3 text-sm">
          <span className="text-xs font-medium text-ink/60">Lieu de livraison</span>
          <CommandeLocalisation
            lat={commande.lat}
            lng={commande.lng}
            precision={commande.precision_livreur}
          />
        </section>
      )}

      <section className="flex flex-col gap-1.5 rounded-2xl border border-ink/10 bg-elevated p-3 text-sm">
        <div className="flex justify-between text-ink/70">
          <span>Sous-total</span>
          <span>{formatPrice(commande.sous_total)}</span>
        </div>
        <div className="flex justify-between text-ink/70">
          <span>Livraison ({commande.mode_livraison})</span>
          <span>{commande.frais_livraison === 0 ? "Gratuite" : formatPrice(commande.frais_livraison)}</span>
        </div>
        <div className="flex justify-between border-t border-ink/10 pt-1.5 font-semibold text-ink">
          <span>Total</span>
          <span>{formatPrice(commande.total)}</span>
        </div>
      </section>
    </div>
  );
}
