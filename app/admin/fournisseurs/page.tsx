import { getFournisseurs } from "@/lib/admin/fournisseurs-actions";
import { FournisseursEditor } from "@/components/admin/fournisseurs-editor";

export const dynamic = "force-dynamic";

export default async function AdminFournisseursPage() {
  const fournisseurs = await getFournisseurs();

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div>
        <h1 className="font-heading text-xl font-bold text-ink">Fournisseurs</h1>
        <p className="mt-1 text-sm text-ink/55">
          Points où récupérer la marchandise. Ils apparaissent sur la carte
          « Livraisons » pour préparer les tournées.
        </p>
      </div>
      <FournisseursEditor fournisseurs={fournisseurs} />
    </div>
  );
}
