import Link from "next/link";
import { Plus } from "lucide-react";
import { getMesProduits, getReferentiel } from "@/lib/vendeur/produits-actions";
import { MesProduits } from "@/components/vendeur/mes-produits";

export default async function MesProduitsPage() {
  const [produits, { categories }] = await Promise.all([getMesProduits(), getReferentiel()]);
  const categoriesNom = Object.fromEntries(categories.map((c) => [c.id, c.nom]));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-heading text-xl font-bold text-[#001314]">Mes produits</h1>
        <Link
          href="/vendeur/produits/nouveau"
          className="flex items-center gap-1.5 rounded-full bg-[#E07B39] px-4 py-2 text-sm font-semibold text-[#001314] active:scale-95"
        >
          <Plus size={16} aria-hidden="true" />
          Ajouter un produit
        </Link>
      </div>

      <p className="text-xs text-[#001314]/50">
        Chaque produit ajouté ou modifié passe en validation SacAdo avant d&apos;être visible
        des clients. La mise à jour du stock, elle, est immédiate.
      </p>

      <MesProduits produits={produits} categoriesNom={categoriesNom} />
    </div>
  );
}
