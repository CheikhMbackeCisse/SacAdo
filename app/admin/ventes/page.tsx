import { getArticlesVendus } from "@/lib/admin/reporting-actions";

export default async function AdminVentesPage() {
  const ventes = await getArticlesVendus();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-xl font-bold text-ink">Articles vendus (cumulé)</h1>
      <p className="text-sm text-ink/50">Sert à savoir quoi racheter.</p>

      <div className="overflow-hidden rounded-2xl border border-ink/10 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-left text-xs text-ink/50">
              <th className="px-4 py-3 font-medium">Produit</th>
              <th className="px-4 py-3 font-medium">Quantité vendue</th>
            </tr>
          </thead>
          <tbody>
            {ventes.map((vente) => (
              <tr key={vente.produitId} className="border-b border-ink/5 last:border-0">
                <td className="px-4 py-3 text-ink">{vente.nom}</td>
                <td className="px-4 py-3 font-semibold text-ink">{vente.quantiteVendue}</td>
              </tr>
            ))}
            {ventes.length === 0 && (
              <tr>
                <td colSpan={2} className="px-4 py-8 text-center text-ink/50">
                  Aucune vente pour l&apos;instant.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
