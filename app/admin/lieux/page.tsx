import { getLieuxConnus } from "@/lib/admin/lieux-actions";
import { LieuxEditor } from "@/components/admin/lieux-editor";

export const dynamic = "force-dynamic";

export default async function AdminLieuxPage() {
  const lieux = await getLieuxConnus();

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div>
        <h1 className="font-heading text-xl font-bold text-ink">Lieux connus</h1>
        <p className="mt-1 text-sm text-ink/55">
          Écoles, campus et points de repère fréquents. Ils remontent en priorité
          dans la recherche d&apos;adresse du checkout, même quand OpenStreetMap ne
          les trouve pas bien.
        </p>
      </div>
      <LieuxEditor lieux={lieux} />
    </div>
  );
}
