import { notFound } from "next/navigation";
import { getProduitAdmin, getHistoriquePrix } from "@/lib/admin/produits-actions";
import { getCategoriesAdmin } from "@/lib/admin/categories-actions";
import { getSousCategoriesAdmin } from "@/lib/admin/sous-categories-actions";
import { getSousSousCategoriesAdmin } from "@/lib/admin/sous-sous-categories-actions";
import { ProduitForm } from "@/components/admin/produit-form";
import { VariantesManager } from "@/components/admin/variantes-manager";
import { formatPrice } from "@/lib/format";

export default async function EditProduitPage(props: PageProps<"/admin/produits/[id]">) {
  const { id } = await props.params;
  const produitId = Number(id);
  if (!Number.isFinite(produitId)) notFound();

  const produit = await getProduitAdmin(produitId);
  if (!produit) notFound();

  const [categories, sousCategories, sousSousCategories, historiquePrix] = await Promise.all([
    getCategoriesAdmin(),
    getSousCategoriesAdmin(),
    getSousSousCategoriesAdmin(),
    getHistoriquePrix(produitId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-xl font-bold text-ink">Modifier « {produit.nom} »</h1>
      <ProduitForm
        produit={produit}
        categories={categories}
        sousCategories={sousCategories}
        sousSousCategories={sousSousCategories}
      />
      <VariantesManager produitId={produit.id} />

      {historiquePrix.length > 0 && (
        <div className="flex max-w-xl flex-col gap-2 rounded-2xl border border-ink/10 bg-white p-5">
          <h2 className="text-sm font-semibold text-ink">Historique des prix</h2>
          <ul className="flex flex-col gap-1.5 text-sm">
            {historiquePrix.map((h, i) => (
              <li key={i} className="flex items-center justify-between text-ink/70">
                <span>
                  {formatPrice(h.ancien_prix)} → {formatPrice(h.nouveau_prix)}
                </span>
                <span className="text-xs text-ink/40">
                  {new Date(h.modifie_le).toLocaleDateString("fr-FR")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
