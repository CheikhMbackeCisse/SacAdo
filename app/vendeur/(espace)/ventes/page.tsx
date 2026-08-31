import { getMesVentes } from "@/lib/vendeur/ventes-actions";
import { formatPrice } from "@/lib/format";

const STATUT_LABEL: Record<string, string> = {
  recue: "Reçue",
  preparation: "En préparation",
  livraison: "En livraison",
  livree: "Livrée",
};

function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export default async function MesVentesPage() {
  const { lignes, totalQuantite, totalMontant } = await getMesVentes();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-xl font-bold text-[#001314]">Mes ventes</h1>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-[#001314]/10 bg-white p-4">
          <p className="text-xs font-medium text-[#001314]/50">Articles vendus</p>
          <p className="mt-1 font-heading text-2xl font-bold text-[#001314]">{totalQuantite}</p>
        </div>
        <div className="rounded-2xl border border-[#001314]/10 bg-white p-4">
          <p className="text-xs font-medium text-[#001314]/50">Montant brut</p>
          <p className="mt-1 font-heading text-2xl font-bold text-[#001314]">
            {formatPrice(totalMontant)}
          </p>
          <p className="mt-1 text-[11px] text-[#001314]/45">
            La commission SacAdo et le montant qui vous sera reversé seront affichés ici
            prochainement.
          </p>
        </div>
      </div>

      {lignes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#001314]/15 bg-white/60 p-8 text-center text-sm text-[#001314]/55">
          Aucune vente pour l&apos;instant.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#001314]/10 bg-white">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-[#001314]/10 text-left text-xs text-[#001314]/50">
                <th className="px-4 py-3 font-medium">Commande</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Produit</th>
                <th className="px-4 py-3 font-medium">Qté</th>
                <th className="px-4 py-3 font-medium">Montant</th>
                <th className="px-4 py-3 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((ligne, i) => (
                <tr key={`${ligne.commande_id}-${ligne.produit_id}-${i}`} className="border-b border-[#001314]/5 last:border-0">
                  <td className="px-4 py-3 text-[#001314]/60">#{ligne.commande_id}</td>
                  <td className="px-4 py-3 text-[#001314]/60">{formatDate(ligne.date)}</td>
                  <td className="px-4 py-3 text-[#001314]">{ligne.produit_nom}</td>
                  <td className="px-4 py-3 text-[#001314]/60">{ligne.quantite}</td>
                  <td className="px-4 py-3 text-[#001314]/60">{formatPrice(ligne.montant)}</td>
                  <td className="px-4 py-3 text-[#001314]/60">
                    {STATUT_LABEL[ligne.statut_commande] ?? ligne.statut_commande}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
