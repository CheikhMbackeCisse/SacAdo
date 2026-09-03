import Link from "next/link";
import { Plus } from "lucide-react";
import { getProduitsAdminPage } from "@/lib/admin/produits-actions";
import { getCategoriesAdmin } from "@/lib/admin/categories-actions";
import { formatPrice } from "@/lib/format";
import { DeleteProduitButton } from "@/components/admin/delete-produit-button";
import { CarteListe, CartesListe, ChampCarte, TableauDesktop } from "@/components/admin/liste-mobile";

const TAILLE_PAGE = 50;

export default async function AdminProduitsPage(props: PageProps<"/admin/produits">) {
  const { page: pageParam } = await props.searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const offset = (page - 1) * TAILLE_PAGE;

  const [{ items: produits, hasMore }, categories] = await Promise.all([
    getProduitsAdminPage({ offset, limit: TAILLE_PAGE }),
    getCategoriesAdmin(),
  ]);
  const nomCategorie = new Map(categories.map((c) => [c.id, c.nom]));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-xl font-bold text-ink">Produits</h1>
        <Link
          href="/admin/produits/nouveau"
          className="flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-surface active:scale-95"
        >
          <Plus size={16} aria-hidden="true" />
          Ajouter un produit
        </Link>
      </div>

      {produits.length === 0 ? (
        <p className="rounded-2xl border border-ink/10 bg-white px-4 py-8 text-center text-sm text-ink/50">
          Aucun produit.
        </p>
      ) : (
        <CartesListe>
          {produits.map((produit) => {
            const stockBas = produit.stock <= produit.seuil_alerte;
            return (
              <CarteListe key={produit.id}>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-ink">{produit.nom}</p>
                  <span className="shrink-0 text-xs text-ink/50">{produit.statut}</span>
                </div>
                <ChampCarte label="Catégorie">
                  {nomCategorie.get(produit.categorie_id) ?? "—"}
                </ChampCarte>
                <ChampCarte label="Prix">{formatPrice(produit.prix)}</ChampCarte>
                <ChampCarte label="Stock / délai">
                  <span className={stockBas ? "font-medium text-red-600" : ""}>{produit.stock}</span>
                  <span className="text-ink/50"> · {produit.delai}</span>
                </ChampCarte>
                <div className="mt-1.5 flex justify-end gap-4 border-t border-ink/10 pt-2">
                  <Link
                    href={`/admin/produits/${produit.id}`}
                    className="text-sm font-medium text-brand hover:underline"
                  >
                    Modifier
                  </Link>
                  <DeleteProduitButton id={produit.id} nom={produit.nom} />
                </div>
              </CarteListe>
            );
          })}
        </CartesListe>
      )}

      <TableauDesktop>
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-left text-xs text-ink/50">
              <th className="px-4 py-3 font-medium">Nom</th>
              <th className="px-4 py-3 font-medium">Catégorie</th>
              <th className="px-4 py-3 font-medium">Prix</th>
              <th className="px-4 py-3 font-medium">Délai</th>
              <th className="px-4 py-3 font-medium">Stock</th>
              <th className="px-4 py-3 font-medium">Statut</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {produits.map((produit) => {
              const stockBas = produit.stock <= produit.seuil_alerte;
              return (
                <tr key={produit.id} className="border-b border-ink/5 last:border-0">
                  <td className="px-4 py-3 text-ink">{produit.nom}</td>
                  <td className="px-4 py-3 text-ink/60">
                    {nomCategorie.get(produit.categorie_id) ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-ink/60">{formatPrice(produit.prix)}</td>
                  <td className="px-4 py-3 text-ink/60">{produit.delai}</td>
                  <td className={`px-4 py-3 font-medium ${stockBas ? "text-red-600" : "text-ink/60"}`}>
                    {produit.stock}
                  </td>
                  <td className="px-4 py-3 text-ink/60">{produit.statut}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-3">
                      <Link href={`/admin/produits/${produit.id}`} className="text-brand hover:underline">
                        Modifier
                      </Link>
                      <DeleteProduitButton id={produit.id} nom={produit.nom} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableauDesktop>

      {(page > 1 || hasMore) && (
        <div className="flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link href={`/admin/produits?page=${page - 1}`} className="text-brand hover:underline">
              ← Précédent
            </Link>
          ) : (
            <span />
          )}
          <span className="text-ink/40">Page {page}</span>
          {hasMore ? (
            <Link href={`/admin/produits?page=${page + 1}`} className="text-brand hover:underline">
              Suivant →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}
