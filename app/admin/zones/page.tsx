import { getZonesAdmin } from "@/lib/admin/zones-actions";
import { ZonesEditor } from "@/components/admin/zones-editor";

export default async function AdminZonesPage() {
  const zones = await getZonesAdmin();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-xl font-bold text-ink">Zones de livraison</h1>
      <ZonesEditor zones={zones} />
    </div>
  );
}
