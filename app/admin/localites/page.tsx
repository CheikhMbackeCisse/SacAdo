import { getLocalitesAdmin } from "@/lib/admin/localites-actions";
import { getZonesAdmin } from "@/lib/admin/zones-actions";
import { LocalitesEditor } from "@/components/admin/localites-editor";

export const dynamic = "force-dynamic";

export default async function AdminLocalitesPage() {
  const [localites, groupes] = await Promise.all([getLocalitesAdmin(), getZonesAdmin()]);

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div>
        <h1 className="font-heading text-xl font-bold text-ink">Localités</h1>
        <p className="mt-1 text-sm text-ink/55">
          Chaque localité est rattachée à un groupe de livraison, qui détermine son tarif.
        </p>
      </div>
      <LocalitesEditor localites={localites} groupes={groupes} />
    </div>
  );
}
