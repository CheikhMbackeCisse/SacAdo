import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getMonProduit, getReferentiel } from "@/lib/vendeur/produits-actions";
import { ProduitVendeurForm } from "@/components/vendeur/produit-vendeur-form";

export default async function ModifierProduitVendeurPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const produitId = Number(id);
  if (!Number.isInteger(produitId)) notFound();

  const [produit, { categories, sousCategories }] = await Promise.all([
    getMonProduit(produitId),
    getReferentiel(),
  ]);
  if (!produit) notFound();

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/vendeur/produits"
        className="flex items-center gap-1 text-sm text-[#001314]/55 hover:text-[#001314]"
      >
        <ArrowLeft size={15} aria-hidden="true" />
        Mes produits
      </Link>
      <h1 className="font-heading text-xl font-bold text-[#001314]">Modifier « {produit.nom} »</h1>
      <ProduitVendeurForm
        produit={produit}
        categories={categories}
        sousCategories={sousCategories}
      />
    </div>
  );
}
