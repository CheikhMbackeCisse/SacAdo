import Link from "next/link";
import { PackageCheck } from "lucide-react";
import { getMesPreparations } from "@/lib/vendeur/preparations-actions";
import {
  refPreparation,
  formatDateHeureDakar,
  etatDemande,
  LIBELLES_ETAT_DEMANDE,
} from "@/lib/preparations";

export const dynamic = "force-dynamic";

const TONS: Record<string, string> = {
  a_preparer: "bg-[#001314]/[0.06] text-[#001314]/60",
  preparee: "bg-[#0B3D91]/10 text-[#0B3D91]",
  recuperee: "bg-[#16A34A]/10 text-[#16A34A]",
};

export default async function VendeurPreparationsPage() {
  const demandes = await getMesPreparations();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-heading text-xl font-bold text-[#001314]">Préparations</h1>
        <p className="mt-1 text-sm text-[#001314]/55">
          Les commandes que SacAdo vous demande de préparer, regroupées par client.
        </p>
      </div>

      {demandes.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[#001314]/15 bg-white/60 p-10 text-center">
          <PackageCheck size={22} className="text-[#001314]/25" aria-hidden="true" />
          <p className="text-sm text-[#001314]/55">Aucune préparation demandée pour l&apos;instant.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {demandes.map((d) => {
            const etat = etatDemande(d.statut, d.recupereeLe);
            return (
              <li key={d.id}>
                <Link
                  href={`/vendeur/preparations/${d.id}`}
                  className="flex flex-col gap-1.5 rounded-2xl border border-[#001314]/10 bg-white p-3.5 text-sm transition-colors hover:border-[#0B3D91]/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-[#0B3D91]">{refPreparation(d.id)}</span>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${TONS[etat]}`}
                    >
                      {LIBELLES_ETAT_DEMANDE[etat]}
                    </span>
                  </div>
                  <p className="text-[#001314]/60">
                    {d.nbArticles} article{d.nbArticles > 1 ? "s" : ""} · {d.nbClients} client
                    {d.nbClients > 1 ? "s" : ""}
                  </p>
                  <p className="text-xs text-[#001314]/40">
                    Demandée le {formatDateHeureDakar(d.creeLe)}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
