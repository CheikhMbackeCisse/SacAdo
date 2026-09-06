import Image from "next/image";
import { Package } from "lucide-react";
import type { GroupeClient, LigneTotal } from "@/lib/admin/preparations-actions";

const MODE_LABEL: Record<string, string> = { "24h": "Livraison 24h", "6j": "Livraison 6 jours", "5j": "Livraison 5 jours" };

// Corps du bon de préparation : articles regroupés par client + total en bas.
// Partagé entre l'aperçu (avant création) et la fiche d'une demande existante.
// Le Lot 3 ajoutera l'en-tête « document SacAdo » (logo, NINEA, horodatage) et
// la version imprimable / accessible par lien.
export function BonPreparation({
  groupes,
  totaux,
  nbArticles,
}: {
  groupes: GroupeClient[];
  totaux: LigneTotal[];
  nbArticles: number;
}) {
  if (groupes.length === 0) {
    return (
      <p className="rounded-2xl border border-ink/10 bg-white px-4 py-8 text-center text-sm text-ink/50">
        Aucun article à préparer.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {groupes.map((g) => (
        <div key={g.commandeId} className="overflow-hidden rounded-2xl border border-ink/10 bg-white">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-ink/10 bg-ink/[0.02] px-4 py-2.5">
            <p className="font-semibold text-ink">{g.clientNom}</p>
            <p className="text-xs text-ink/50">
              Commande #{g.commandeId}
              {g.modeLivraison && ` · ${MODE_LABEL[g.modeLivraison] ?? g.modeLivraison}`}
              {g.zoneNom && ` · ${g.zoneNom}`}
            </p>
          </div>
          <ul className="divide-y divide-ink/5">
            {g.articles.map((a, i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-ink/5">
                  {a.produitPhoto ? (
                    <Image
                      src={a.produitPhoto}
                      alt=""
                      width={40}
                      height={40}
                      className="size-full object-cover"
                    />
                  ) : (
                    <Package size={16} className="text-ink/30" aria-hidden="true" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-ink">{a.produitNom}</span>
                  {a.varianteLabel && (
                    <span className="block truncate text-xs text-ink/50">{a.varianteLabel}</span>
                  )}
                </span>
                <span className="shrink-0 font-semibold text-ink">× {a.quantite}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className="rounded-2xl border border-brand/25 bg-brand/[0.04] p-4">
        <p className="text-sm font-semibold text-ink">
          Total à préparer <span className="font-normal text-ink/50">({nbArticles} article{nbArticles > 1 ? "s" : ""})</span>
        </p>
        <ul className="mt-2 flex flex-col gap-1 text-sm">
          {totaux.map((t, i) => (
            <li key={i} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 text-ink/80">
                {t.produitNom}
                {t.varianteLabel && <span className="text-ink/50"> — {t.varianteLabel}</span>}
              </span>
              <span className="shrink-0 font-semibold text-ink">× {t.quantite}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
