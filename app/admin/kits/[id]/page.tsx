import { notFound } from "next/navigation";
import { getKitAdmin, getKitItemsAdmin } from "@/lib/admin/kits-actions";
import { getProduitsAdmin } from "@/lib/admin/produits-actions";
import { KitItemsManager } from "@/components/admin/kit-items-manager";

export default async function EditKitPage(props: PageProps<"/admin/kits/[id]">) {
  const { id } = await props.params;
  const kitId = Number(id);
  if (!Number.isFinite(kitId)) notFound();

  const kit = await getKitAdmin(kitId);
  if (!kit) notFound();

  const [items, produits] = await Promise.all([getKitItemsAdmin(kitId), getProduitsAdmin()]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-xl font-bold text-ink">{kit.nom}</h1>
      <KitItemsManager kitId={kit.id} items={items} produits={produits} />
    </div>
  );
}
