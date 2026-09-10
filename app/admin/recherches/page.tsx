import { getRecherchesVides } from "@/lib/admin/recherches-actions";
import { getSynonymes } from "@/lib/admin/synonymes-actions";
import { RecherchesVidesListe } from "@/components/admin/recherches-vides-liste";

export const dynamic = "force-dynamic";

export default async function AdminRecherchesPage() {
  const [recherches, groupes] = await Promise.all([getRecherchesVides(), getSynonymes()]);

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div>
        <h1 className="font-heading text-xl font-bold text-ink">Recherches sans résultat</h1>
        <p className="mt-1 text-sm text-ink/55">
          Ce que les clients ont cherché sur les 30 derniers jours sans rien trouver, du plus
          fréquent au moins fréquent. Si le produit existe sous un autre nom, rattache le terme à
          un groupe de synonymes ; sinon, marque-le comme produit à sourcer.
        </p>
      </div>
      <RecherchesVidesListe recherches={recherches} groupes={groupes} />
    </div>
  );
}
