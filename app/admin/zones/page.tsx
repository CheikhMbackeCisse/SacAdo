import { getSeuilLivraisonGratuiteActuel, getZonesAdmin } from "@/lib/admin/zones-actions";
import { ZonesEditor } from "@/components/admin/zones-editor";
import { ReglageSeuilLivraison } from "@/components/admin/reglage-seuil-livraison";

export const dynamic = "force-dynamic";

export default async function AdminZonesPage() {
  const [zones, seuilGratuite] = await Promise.all([getZonesAdmin(), getSeuilLivraisonGratuiteActuel()]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-heading text-xl font-bold text-ink">Groupes de livraison</h1>
        <p className="mt-1 text-sm text-ink/55">
          Chaque localité (page « Localités ») est rattachée à l&apos;un de ces groupes, qui
          détermine son tarif. Les anciennes lignes par région (Dakar, Thiès…) ne sont plus
          utilisées par le checkout.
        </p>
      </div>
      <ReglageSeuilLivraison valeur={seuilGratuite} />
      <ZonesEditor zones={zones} />
    </div>
  );
}
