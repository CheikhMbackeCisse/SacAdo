import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, BookOpen, Check, Package } from "lucide-react";
import { getCycleByValue } from "@/lib/cycles";
import { GAMMES } from "@/lib/gammes";
import { getKitsByCycleNiveau, getKitItemsAvecProduits } from "@/lib/supabase/queries";
import { formatPrice } from "@/lib/format";

// ISR : le contenu des kits change rarement.
export const revalidate = 120;

export default async function GammeChoixPage(props: PageProps<"/kits/[cycle]/[niveau]">) {
  const { cycle, niveau: niveauParam } = await props.params;
  const niveau = decodeURIComponent(niveauParam);
  const cycleDef = getCycleByValue(cycle);
  if (!cycleDef || !cycleDef.classes.includes(niveau)) notFound();

  const kits = await getKitsByCycleNiveau(cycle, niveau);

  if (kits.length === 0) {
    return (
      <div className="animate-fade-in-up flex flex-1 flex-col items-center justify-center gap-3 px-6 py-24 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-brand/10 text-brand">
          <Package size={26} aria-hidden="true" />
        </span>
        <h1 className="font-heading text-lg font-semibold text-ink">Kit {niveau} bientôt disponible</h1>
        <p className="max-w-xs text-sm text-ink/60">
          Ce kit n&apos;a pas encore été composé pour le niveau {niveau} ({cycleDef.label}).
        </p>
      </div>
    );
  }

  // Contenu de chaque gamme, pour un comparatif honnête (ce que la gamme
  // supérieure ajoute réellement).
  const contenus = await Promise.all(
    kits.map(async (kit) => {
      const items = await getKitItemsAvecProduits(kit.id);
      const total = items.reduce((sum, it) => sum + it.quantite_defaut * it.produit.prix, 0);
      const noms = new Set(items.map((it) => it.produit.nom));
      return { kit, nbArticles: items.length, total, noms };
    }),
  );

  return (
    <div className="animate-fade-in-up flex flex-col gap-5 px-4 py-6">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-brand">{cycleDef.label}</span>
        <h1 className="font-heading text-2xl font-bold text-ink">Kit {niveau}</h1>
        <p className="text-sm text-ink/60">
          Trois gammes selon votre budget. Ajustez la liste ensuite, rien n&apos;est figé.
        </p>
      </div>

      <div className="flex items-center gap-2.5 rounded-2xl border border-decorative/30 bg-decorative/10 px-4 py-3">
        <BookOpen size={18} className="shrink-0 text-ink/70" aria-hidden="true" />
        <p className="text-xs text-ink/80">
          L&apos;<span className="font-semibold">ebook de la classe</span> est offert avec l&apos;achat du
          kit complet de {niveau}, quelle que soit la gamme choisie.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {contenus.map(({ kit, nbArticles, total, noms }, index) => {
          const def = GAMMES.find((g) => g.value === kit.gamme);
          const precedent = index > 0 ? contenus[index - 1].noms : null;
          const ajouts = precedent
            ? [...noms].filter((nom) => !precedent.has(nom))
            : [];
          const miseEnAvant = kit.gamme === "confort";

          return (
            <Link
              key={kit.id}
              href={`/kits/${cycle}/${encodeURIComponent(niveau)}/${kit.gamme}`}
              className={`group flex flex-col gap-3 rounded-2xl border bg-elevated p-4 transition-shadow hover:shadow-md ${
                miseEnAvant ? "border-brand/50 ring-1 ring-brand/25" : "border-ink/10"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col">
                  <span className="font-heading text-lg font-bold text-ink">{def?.label ?? kit.gamme}</span>
                  <span className="text-xs text-ink/55">{def?.tagline}</span>
                </div>
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand transition-transform group-hover:translate-x-0.5">
                  <ArrowRight size={15} aria-hidden="true" />
                </span>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-base font-semibold text-ink">{formatPrice(total)}</span>
                <span className="text-xs text-ink/50">
                  {nbArticles} article{nbArticles > 1 ? "s" : ""}
                </span>
              </div>

              {index === 0 ? (
                <p className="text-xs text-ink/60">{def?.apport}</p>
              ) : ajouts.length > 0 ? (
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-ink/45">
                    {contenus[index - 1].kit.gamme === "essentiel"
                      ? "En plus de l'Essentiel"
                      : `En plus du ${GAMMES.find((g) => g.value === contenus[index - 1].kit.gamme)?.label}`}
                  </span>
                  <ul className="flex flex-col gap-1">
                    {ajouts.slice(0, 4).map((nom) => (
                      <li key={nom} className="flex items-start gap-1.5 text-xs text-ink/75">
                        <Check size={13} className="mt-0.5 shrink-0 text-success" aria-hidden="true" />
                        {nom}
                      </li>
                    ))}
                    {ajouts.length > 4 && (
                      <li className="pl-[19px] text-xs text-ink/50">+ {ajouts.length - 4} autres</li>
                    )}
                  </ul>
                </div>
              ) : (
                <p className="text-xs text-ink/60">{def?.apport}</p>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
