import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getVendeursAvecArticlesEnAttente } from "@/lib/admin/preparations-actions";
import { PreparationNouvelle } from "@/components/admin/preparation-nouvelle";

export const dynamic = "force-dynamic";

export default async function AdminPreparationNouvellePage() {
  const vendeurs = await getVendeursAvecArticlesEnAttente();

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div>
        <Link
          href="/admin/preparations"
          className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-ink/50 hover:text-brand"
        >
          <ArrowLeft size={13} aria-hidden="true" />
          Préparations
        </Link>
        <h1 className="font-heading text-xl font-bold text-ink">Nouvelle demande de préparation</h1>
        <p className="mt-1 text-sm text-ink/55">
          Choisis un fournisseur : tu verras tout ce qu&apos;il doit préparer, regroupé par
          client. Les articles déjà inclus dans une demande n&apos;apparaissent plus.
        </p>
      </div>

      <PreparationNouvelle vendeurs={vendeurs} />
    </div>
  );
}
