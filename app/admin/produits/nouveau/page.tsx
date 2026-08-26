import { ProduitForm } from "@/components/admin/produit-form";

export default function NouveauProduitPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-xl font-bold text-ink">Nouveau produit</h1>
      <ProduitForm />
    </div>
  );
}
