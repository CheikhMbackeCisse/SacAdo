import { notFound } from "next/navigation";
import Link from "next/link";
import { getCommandeAdmin, getCommandeItemsAdmin } from "@/lib/admin/commandes-actions";
import { formatPrice } from "@/lib/format";
import { LIBELLES_STATUT_PAIEMENT } from "@/lib/commandes";
import { StatutSelect } from "@/components/admin/statut-select";
import { CommandeLocalisation } from "@/components/checkout/commande-localisation";

export default async function AdminCommandeDetailPage(props: PageProps<"/admin/commandes/[id]">) {
  const { id } = await props.params;
  const commandeId = Number(id);
  if (!Number.isFinite(commandeId)) notFound();

  const [commande, items] = await Promise.all([
    getCommandeAdmin(commandeId),
    getCommandeItemsAdmin(commandeId),
  ]);
  if (!commande) notFound();

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/commandes" className="text-sm text-brand hover:underline">
        ← Toutes les commandes
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="font-heading text-xl font-bold text-ink">Commande #{commande.id}</h1>
        <StatutSelect commandeId={commande.id} statutActuel={commande.statut} />
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-white p-4 text-sm">
        <div>
          <p className="font-semibold text-ink">{commande.client_nom}</p>
          <p className="text-ink/50">{commande.client_telephone}</p>
          {commande.adresse && <p className="mt-2 text-ink/70">{commande.adresse}</p>}
          <p className="text-ink/50">Livraison {commande.mode_livraison}</p>
        </div>

        <div className="border-t border-ink/10 pt-3">
          <p className="text-xs font-medium text-ink/50">Paiement</p>
          {commande.mode_paiement === "wave" ? (
            <p className="text-ink/80">
              Wave —{" "}
              <span
                className={
                  commande.statut_paiement === "payee"
                    ? "font-semibold text-success"
                    : commande.statut_paiement === "en_attente"
                      ? "font-semibold text-brand"
                      : "font-semibold text-ink/60"
                }
              >
                {commande.statut_paiement
                  ? LIBELLES_STATUT_PAIEMENT[commande.statut_paiement]
                  : "—"}
              </span>
              {commande.montant_paye != null && (
                <span className="text-ink/50"> · {formatPrice(commande.montant_paye)} encaissés</span>
              )}
            </p>
          ) : (
            <p className="text-ink/80">À la livraison</p>
          )}
        </div>

        {commande.lat != null && commande.lng != null ? (
          <CommandeLocalisation
            lat={commande.lat}
            lng={commande.lng}
            precision={commande.precision_livreur}
            liensNavigation
          />
        ) : (
          <p className="text-xs text-ink/40">Aucune position de livraison enregistrée.</p>
        )}

        {commande.enfants_ebook && (
          <p className="rounded-lg bg-brand/5 px-2 py-1.5 text-xs text-ink/80">
            <span className="font-semibold text-ink">Ebook à personnaliser :</span>{" "}
            {commande.enfants_ebook}
          </p>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-ink/10 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-left text-xs text-ink/50">
              <th className="px-4 py-3 font-medium">Article</th>
              <th className="px-4 py-3 font-medium">Qté</th>
              <th className="px-4 py-3 font-medium">Prix unitaire</th>
              <th className="px-4 py-3 font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-ink/5 last:border-0">
                <td className="px-4 py-3 text-ink">{item.produit_nom}</td>
                <td className="px-4 py-3 text-ink/60">{item.quantite}</td>
                <td className="px-4 py-3 text-ink/60">{formatPrice(item.prix_unitaire)}</td>
                <td className="px-4 py-3 font-medium text-ink">
                  {formatPrice(item.prix_unitaire * item.quantite)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-1 rounded-2xl border border-ink/10 bg-white p-4 text-sm">
        <div className="flex justify-between text-ink/70">
          <span>Sous-total</span>
          <span>{formatPrice(commande.sous_total)}</span>
        </div>
        <div className="flex justify-between text-ink/70">
          <span>Livraison</span>
          <span>{commande.frais_livraison === 0 ? "Gratuite" : formatPrice(commande.frais_livraison)}</span>
        </div>
        <div className="flex justify-between border-t border-ink/10 pt-1.5 font-semibold text-ink">
          <span>Total</span>
          <span>{formatPrice(commande.total)}</span>
        </div>
      </div>
    </div>
  );
}
