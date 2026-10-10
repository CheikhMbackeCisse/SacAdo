import Link from "next/link";
import { getListesAdmin } from "@/lib/admin/listes-actions";
import { formatPrice } from "@/lib/format";
import { NouvelleListeForm } from "@/components/admin/nouvelle-liste-form";
import { ListeStatutToggle } from "@/components/admin/liste-statut-toggle";
import { PullToRefresh } from "@/components/admin/pull-to-refresh";

export default async function AdminListesPage() {
  const listes = await getListesAdmin();

  return (
    <PullToRefresh>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="font-heading text-xl font-bold text-ink">Listes personnalisées</h1>
        </div>

        <NouvelleListeForm />

        <div className="overflow-x-auto rounded-2xl border border-ink/10 bg-white">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-ink/10 text-left text-xs text-ink/50">
                <th className="px-4 py-3 font-medium">Titre</th>
                <th className="px-4 py-3 font-medium">Articles</th>
                <th className="px-4 py-3 font-medium">Prix calculé</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {listes.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-ink/50">
                    Aucune liste pour l&apos;instant.
                  </td>
                </tr>
              )}
              {listes.map((liste) => (
                <tr key={liste.id} className="border-b border-ink/5 align-top last:border-0">
                  <td className="px-4 py-3 text-ink">
                    {liste.titre}
                    {liste.lignes_cachees.length > 0 && (
                      <p className="text-xs font-medium text-amber-600">
                        {liste.lignes_cachees.length} article{liste.lignes_cachees.length > 1 ? "s" : ""} masqué
                        {liste.lignes_cachees.length > 1 ? "s" : ""} côté client
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink/60">{liste.nb_items}</td>
                  <td className="px-4 py-3 font-semibold text-ink">{formatPrice(liste.prix_calcule)}</td>
                  <td className="px-4 py-3">
                    <ListeStatutToggle listeId={liste.id} statut={liste.statut} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/listes/${liste.id}`} className="text-brand hover:underline">
                      Gérer
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PullToRefresh>
  );
}
