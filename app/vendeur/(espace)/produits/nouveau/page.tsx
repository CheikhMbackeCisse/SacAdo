import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getReferentiel } from "@/lib/vendeur/produits-actions";
import { ProduitVendeurForm } from "@/components/vendeur/produit-vendeur-form";

export default async function NouveauProduitVendeurPage() {
  const { categories, sousCategories, sousSousCategories, commissions, attributs } =
    await getReferentiel();

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/vendeur/produits"
        className="flex items-center gap-1 text-sm text-[#001314]/55 hover:text-[#001314]"
      >
        <ArrowLeft size={15} aria-hidden="true" />
        Mes produits
      </Link>
      <h1 className="font-heading text-xl font-bold text-[#001314]">Ajouter un produit</h1>
      <ProduitVendeurForm
        categories={categories}
        sousCategories={sousCategories}
        sousSousCategories={sousSousCategories}
        commissions={commissions}
        attributs={attributs}
      />
    </div>
  );
}
