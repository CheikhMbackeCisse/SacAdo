import Link from "next/link";
import { getKitsAdmin, type FiltresKitsAdmin } from "@/lib/admin/kits-actions";
import { getGammeDef, GAMMES } from "@/lib/gammes";
import { formatPrice } from "@/lib/format";
import { NouveauKitForm } from "@/components/admin/nouveau-kit-form";
import { KitStatutToggle } from "@/components/admin/kit-statut-toggle";
import { DupliquerKitButton } from "@/components/admin/dupliquer-kit-button";
import { RemplacerProduitKits } from "@/components/admin/remplacer-produit-kits";
import { ImporterKits } from "@/components/admin/importer-kits";
import { getProduitsAdmin } from "@/lib/admin/produits-actions";
import { Download } from "lucide-react";
import { PullToRefresh } from "@/components/admin/pull-to-refresh";

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

function chaine(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" && v ? v : undefined;
}

export default async function AdminKitsPage(props: PageProps<"/admin/kits">) {
  const sp = await props.searchParams;
  const filtres: FiltresKitsAdmin = {
    cycle: chaine(sp.cycle) as FiltresKitsAdmin["cycle"],
    niveau: chaine(sp.niveau),
    gamme: chaine(sp.gamme) as FiltresKitsAdmin["gamme"],
    statut: chaine(sp.statut) as FiltresKitsAdmin["statut"],
  };
  const [kits, tousLesKits, produits] = await Promise.all([
    getKitsAdmin(filtres),
    getKitsAdmin(),
    getProduitsAdmin(),
  ]);
  const niveaux = [...new Set(tousLesKits.map((k) => k.niveau))].sort();
  const optionsProduits = produits.map((p) => ({ value: String(p.id), label: p.nom }));

  return (
    <PullToRefresh>
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-xl font-bold text-ink">Kits</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/kits/export"
            className="flex items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/70"
          >
            <Download size={14} aria-hidden="true" />
            Exporter en Excel
          </Link>
          <ImporterKits />
        </div>
      </div>

      <NouveauKitForm />
      <RemplacerProduitKits produits={optionsProduits} />

      <form method="get" className="flex flex-wrap items-center gap-2 rounded-2xl border border-ink/10 bg-white p-3">
        <select
          name="cycle"
          defaultValue={filtres.cycle ?? ""}
          className="rounded-full border border-ink/15 px-3 py-1.5 text-xs"
        >
          <option value="">Tous les cycles</option>
          {Object.entries(LABELS_CYCLE).map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
        <select
          name="niveau"
          defaultValue={filtres.niveau ?? ""}
          className="rounded-full border border-ink/15 px-3 py-1.5 text-xs"
        >
          <option value="">Toutes les classes</option>
          {niveaux.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <select
          name="gamme"
          defaultValue={filtres.gamme ?? ""}
          className="rounded-full border border-ink/15 px-3 py-1.5 text-xs"
        >
          <option value="">Toutes les gammes</option>
          {GAMMES.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </select>
        <select
          name="statut"
          defaultValue={filtres.statut ?? ""}
          className="rounded-full border border-ink/15 px-3 py-1.5 text-xs"
        >
          <option value="">Tous les statuts</option>
          <option value="publie">Publié</option>
          <option value="masque">Masqué</option>
        </select>
        <button type="submit" className="rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/70">
          Filtrer
        </button>
        {(filtres.cycle || filtres.niveau || filtres.gamme || filtres.statut) && (
          <Link href="/admin/kits" className="text-xs text-brand hover:underline">
            Réinitialiser
          </Link>
        )}
      </form>

      <div className="overflow-x-auto rounded-2xl border border-ink/10 bg-white">
        <table className="w-full min-w-[760px] text-sm">
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
              <tr
                key={kit.id}
                className={`border-b align-top last:border-0 ${
                  kit.ordre_prix_invalide ? "border-red-100 bg-red-50/60" : "border-ink/5"
                }`}
              >
                <td className="px-4 py-3 text-ink">
                  {kit.nom}
                  {kit.ordre_prix_invalide && (
                    <p className="text-xs font-medium text-red-600">
                      Ordre des prix incohérent (Essentiel ≤ Complet ≤ Confort)
                    </p>
                  )}
                </td>
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
                  <div className="flex flex-col items-end gap-1.5">
                    <Link href={`/admin/kits/${kit.id}`} className="text-brand hover:underline">
                      Gérer les articles
                    </Link>
                    <DupliquerKitButton kitId={kit.id} gammeActuelle={kit.gamme} nom={kit.nom} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    </PullToRefresh>
  );
}
