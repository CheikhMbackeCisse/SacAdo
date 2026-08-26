import { notFound } from "next/navigation";
import { getProduitAdmin } from "@/lib/admin/produits-actions";
import { ProduitForm } from "@/components/admin/produit-form";
import { VariantesManager } from "@/components/admin/variantes-manager";

export default async function EditProduitPage(props: PageProps<"/admin/produits/[id]">) {
  const { id } = await props.params;
  const produitId = Number(id);
  if (!Number.isFinite(produitId)) notFound();

  const produit = await getProduitAdmin(produitId);
  if (!produit) notFound();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-xl font-bold text-ink">Modifier « {produit.nom} »</h1>
      <ProduitForm produit={produit} />
      <VariantesManager produitId={produit.id} />
    </div>
  );
}
