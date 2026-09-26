import Link from "next/link";
import { getKitsAdmin } from "@/lib/admin/kits-actions";
import { getGammeDef } from "@/lib/gammes";
import { formatPrice } from "@/lib/format";
import { NouveauKitForm } from "@/components/admin/nouveau-kit-form";
import { KitStatutToggle } from "@/components/admin/kit-statut-toggle";

const LABELS_CYCLE: Record<string, string> = {
  prescolaire: "Préscolaire",
  elementaire: "Élémentaire",
  college: "Collège",
  lycee: "Lycée",
};

const LABELS_MOTIF: Record<string, string> = {
  masque: "produit masqué",
  rupture: "en rupture",
  sans_prix: "sans prix de vente",
};

export default async function AdminKitsPage() {
  const kits = await getKitsAdmin();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-xl font-bold text-ink">Kits</h1>

      <NouveauKitForm />

      <div className="overflow-x-auto rounded-2xl border border-ink/10 bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-left text-xs text-ink/50">
              <th className="px-4 py-3 font-medium">Nom</th>
              <th className="px-4 py-3 font-medium">Cycle</th>
              <th className="px-4 py-3 font-medium">Niveau</th>
              <th className="px-4 py-3 font-medium">Gamme</th>
              <th className="px-4 py-3 font-medium">Prix calculé</th>
              <th className="px-4 py-3 font-medium">Lignes affichées</th>
              <th className="px-4 py-3 font-medium">Statut</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {kits.map((kit) => (
              <tr key={kit.id} className="border-b border-ink/5 align-top last:border-0">
                <td className="px-4 py-3 text-ink">{kit.nom}</td>
                <td className="px-4 py-3 text-ink/60">{LABELS_CYCLE[kit.cycle]}</td>
                <td className="px-4 py-3 text-ink/60">{kit.niveau}</td>
                <td className="px-4 py-3 text-ink/60">{getGammeDef(kit.gamme)?.label ?? kit.gamme}</td>
                <td className="px-4 py-3 font-semibold text-ink">{formatPrice(kit.prix_calcule)}</td>
                <td className="px-4 py-3 text-ink/60">
                  <div className="flex flex-col gap-1">
                    <span>
                      {kit.nb_items_affiches} / {kit.nb_items_total}
                    </span>
                    {kit.lignes_cachees.length > 0 && (
                      <ul className="flex flex-col gap-0.5 text-xs text-ink/45">
                        {kit.lignes_cachees.map((l, i) => (
                          <li key={i}>
                            {l.libelle_besoin ?? l.produit_nom} — {LABELS_MOTIF[l.motif]}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <KitStatutToggle kitId={kit.id} statut={kit.statut} />
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/kits/${kit.id}`} className="text-brand hover:underline">
                    Gérer les articles
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
