import { getRecherchesVides } from "@/lib/admin/recherches-actions";
import { getSynonymes } from "@/lib/admin/synonymes-actions";
import { getDemandes } from "@/lib/admin/demandes-actions";
import { RecherchesVidesListe } from "@/components/admin/recherches-vides-liste";
import { DemandesListe } from "@/components/admin/demandes-liste";

export const dynamic = "force-dynamic";

// « Ce que les clients cherchent » (TACHE_corrections_2.md §3.6) : deux angles de
// la même information — les demandes explicites (« Demander un produit ») et les
// recherches restées sans résultat. Ensemble, elles disent quoi ajouter au
// catalogue.
export default async function AdminRecherchesPage() {
  const [demandes, recherches, groupes] = await Promise.all([
    getDemandes("toutes"),
    getRecherchesVides(),
    getSynonymes(),
  ]);

  const nouvelles = demandes.filter((d) => d.statut === "nouvelle").length;

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <div>
        <h1 className="font-heading text-xl font-bold text-ink">Ce que les clients cherchent</h1>
        <p className="mt-1 text-sm text-ink/55">
          Les demandes explicites et les recherches sans résultat, côte à côte : c&apos;est
          ce qui dit quels produits faire entrer au catalogue.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-heading text-lg font-semibold text-ink">
            Demandes de produits{nouvelles > 0 ? ` · ${nouvelles} nouvelle${nouvelles > 1 ? "s" : ""}` : ""}
          </h2>
          <p className="mt-0.5 text-sm text-ink/55">
            Envoyées via « Demander un produit » (écran Moi, recherche sans résultat, bas de
            catégorie). Réponds sur WhatsApp ; quand le produit entre au catalogue, rattache-le
            pour proposer un message tout prêt.
          </p>
        </div>
        <DemandesListe demandes={demandes} />
      </section>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-heading text-lg font-semibold text-ink">Recherches sans résultat</h2>
          <p className="mt-0.5 text-sm text-ink/55">
            Ce que les clients ont cherché sur les 30 derniers jours sans rien trouver, du plus
            fréquent au moins fréquent. Si le produit existe sous un autre nom, rattache le terme
            à un groupe de synonymes ; sinon, marque-le comme produit à sourcer.
          </p>
        </div>
        <RecherchesVidesListe recherches={recherches} groupes={groupes} />
      </section>
    </div>
  );
}
