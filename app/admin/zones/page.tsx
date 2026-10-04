import {
  getDatesFermeesAdmin,
  getHeureLimiteSamediActuelle,
  getPaiementLivraisonMaxActuel,
  getSeuilLivraisonGratuiteActuel,
  getZonesAdmin,
} from "@/lib/admin/zones-actions";
import { ZonesEditor } from "@/components/admin/zones-editor";
import { ReglageSeuilLivraison } from "@/components/admin/reglage-seuil-livraison";
import { ReglageLivraisonDatee } from "@/components/admin/reglage-livraison-datee";
import { ReglagePaiementLivraisonMax } from "@/components/admin/reglage-paiement-livraison-max";

export const dynamic = "force-dynamic";

export default async function AdminZonesPage() {
  const [zones, seuilGratuite, heureLimiteSamedi, datesFermees, paiementLivraisonMax] = await Promise.all([
    getZonesAdmin(),
    getSeuilLivraisonGratuiteActuel(),
    getHeureLimiteSamediActuelle(),
    getDatesFermeesAdmin(),
    getPaiementLivraisonMaxActuel(),
  ]);

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
      <ReglagePaiementLivraisonMax valeur={paiementLivraisonMax} />
      <ReglageLivraisonDatee heureLimiteSamedi={heureLimiteSamedi} datesFermees={datesFermees} />
      <ZonesEditor zones={zones} />
    </div>
  );
}
