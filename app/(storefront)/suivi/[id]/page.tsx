import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { formatPrice } from "@/lib/format";
import { OrderStepper } from "@/components/suivi/order-stepper";
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

  return (
    <div className="animate-fade-in-up flex flex-col gap-6 px-4 py-6">
      <div>
        <h1 className="font-heading text-xl font-bold text-ink">Commande #{commande.id}</h1>
        <p className="text-sm text-ink/60">Merci ! Ta commande a bien été reçue.</p>
      </div>

      <OrderStepper statut={commande.statut} />

      <section className="flex flex-col gap-1.5 rounded-2xl border border-ink/10 bg-white p-3 text-sm">
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
