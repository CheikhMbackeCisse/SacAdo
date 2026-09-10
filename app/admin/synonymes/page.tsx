import { getSynonymes } from "@/lib/admin/synonymes-actions";
import { SynonymesEditor } from "@/components/admin/synonymes-editor";

export const dynamic = "force-dynamic";

export default async function AdminSynonymesPage() {
  const groupes = await getSynonymes();

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div>
        <h1 className="font-heading text-xl font-bold text-ink">Synonymes de recherche</h1>
        <p className="mt-1 text-sm text-ink/55">
          Ce que le client tape n&apos;est pas ce qui est écrit sur l&apos;emballage : on cherche
          un stylo à « bic » et une clé USB à « flash ». Les termes d&apos;un même groupe sont
          équivalents dans les deux sens. Toute modification s&apos;applique à la recherche
          immédiatement, sans redéploiement.
        </p>
      </div>
      <SynonymesEditor groupes={groupes} />
    </div>
  );
}
