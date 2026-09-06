import Link from "next/link";
import { Plus } from "lucide-react";
import { listerDemandesPreparation } from "@/lib/admin/preparations-actions";
import { refPreparation, formatDateHeureDakar } from "@/lib/preparations";
import { CarteListe, CartesListe, ChampCarte, TableauDesktop } from "@/components/admin/liste-mobile";
import { PastilleDemande } from "@/components/admin/pastille-demande";
import { SupprimerDemandeBouton } from "@/components/admin/preparation-supprimer";

export const dynamic = "force-dynamic";

const formatDateHeure = formatDateHeureDakar;

export default async function AdminPreparationsPage() {
  const demandes = await listerDemandesPreparation();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="font-heading text-xl font-bold text-ink">Préparations fournisseurs</h1>
          <p className="mt-1 text-sm text-ink/55">
            Demandes envoyées aux fournisseurs : quoi préparer, regroupé par client, et où
            en est chaque demande.
          </p>
        </div>
        <Link
          href="/admin/preparations/nouvelle"
          className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-brand px-4 text-sm font-semibold text-on-brand active:scale-95"
        >
          <Plus size={16} aria-hidden="true" />
          Nouvelle demande
        </Link>
      </div>

      {demandes.length === 0 ? (
        <p className="rounded-2xl border border-ink/10 bg-white px-4 py-10 text-center text-sm text-ink/50">
          Aucune demande de préparation pour l&apos;instant.
        </p>
      ) : (
        <>
          <CartesListe>
            {demandes.map((d) => (
              <CarteListe key={d.id}>
                <div className="flex items-center justify-between gap-2">
                  <Link
                    href={`/admin/preparations/${d.id}`}
                    className="font-semibold text-brand hover:underline"
                  >
                    {refPreparation(d.id)}
                  </Link>
                  <PastilleDemande statut={d.statut} recupereeLe={d.recupereeLe} />
                </div>
                <ChampCarte label="Fournisseur">{d.vendeurNom}</ChampCarte>
                <ChampCarte label="Articles">
                  {d.nbArticles} · {d.nbClients} client{d.nbClients > 1 ? "s" : ""}
                </ChampCarte>
                <ChampCarte label="Créée le">{formatDateHeure(d.creeLe)}</ChampCarte>
                {d.declenchement === "auto_24h" && (
                  <ChampCarte label="Déclenchement">Auto (24h)</ChampCarte>
                )}
                <div className="mt-1 flex justify-end">
                  <SupprimerDemandeBouton id={d.id} reference={refPreparation(d.id)} />
                </div>
              </CarteListe>
            ))}
          </CartesListe>

          <TableauDesktop>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink/10 text-left text-xs text-ink/50">
                  <th className="px-4 py-3 font-medium">Référence</th>
                  <th className="px-4 py-3 font-medium">Fournisseur</th>
                  <th className="px-4 py-3 font-medium">Articles</th>
                  <th className="px-4 py-3 font-medium">Clients</th>
                  <th className="px-4 py-3 font-medium">Créée le</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {demandes.map((d) => (
                  <tr key={d.id} className="border-b border-ink/5 last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/admin/preparations/${d.id}`} className="text-brand hover:underline">
                        {refPreparation(d.id)}
                      </Link>
                      {d.declenchement === "auto_24h" && (
                        <span className="ml-1.5 text-xs text-ink/40">auto</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink">{d.vendeurNom}</td>
                    <td className="px-4 py-3 text-ink/60">{d.nbArticles}</td>
                    <td className="px-4 py-3 text-ink/60">{d.nbClients}</td>
                    <td className="px-4 py-3 text-ink/60">{formatDateHeure(d.creeLe)}</td>
                    <td className="px-4 py-3">
                      <PastilleDemande statut={d.statut} recupereeLe={d.recupereeLe} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <SupprimerDemandeBouton id={d.id} reference={refPreparation(d.id)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableauDesktop>
        </>
      )}
    </div>
  );
}
