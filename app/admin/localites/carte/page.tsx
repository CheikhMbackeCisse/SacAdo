import Link from "next/link";
import { getLocalitesAdmin } from "@/lib/admin/localites-actions";
import { getZonesAdmin } from "@/lib/admin/zones-actions";
import { LocalitesCarte } from "@/components/admin/localites-carte";

export const dynamic = "force-dynamic";

export default async function AdminLocalitesCartePage() {
  const [localites, groupes] = await Promise.all([getLocalitesAdmin(), getZonesAdmin()]);

  return (
    <div className="flex h-[calc(100dvh-5.5rem)] flex-col gap-3 lg:h-[calc(100dvh-3rem)]">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="font-heading text-xl font-bold text-ink">Localités sur la carte</h1>
          <p className="mt-1 text-sm text-ink/55">
            Déplace un point, règle son rayon de couverture, ou dessine une zone qui l&apos;emporte sur le rayon.
          </p>
        </div>
        <Link href="/admin/localites" className="shrink-0 text-sm text-brand hover:underline">
          Liste classique →
        </Link>
      </div>

      <LocalitesCarte localites={localites} groupes={groupes} />
    </div>
  );
}
