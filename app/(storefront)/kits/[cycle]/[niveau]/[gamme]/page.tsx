import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen, Package } from "lucide-react";
import { getCycleByValue } from "@/lib/cycles";
import { getGammeDef, isGamme } from "@/lib/gammes";
import {
  getKitByCycleNiveauGamme,
  getKitItemsAvecProduits,
  getSacsDisponibles,
} from "@/lib/supabase/queries";
import { KitBuilder } from "@/components/kits/kit-builder";
import { ShareButton } from "@/components/ui/share-button";

export const revalidate = 120;

export default async function KitGammePage(props: PageProps<"/kits/[cycle]/[niveau]/[gamme]">) {
  const { cycle, niveau: niveauParam, gamme } = await props.params;
  const niveau = decodeURIComponent(niveauParam);
  const cycleDef = getCycleByValue(cycle);
  if (!cycleDef || !cycleDef.classes.includes(niveau) || !isGamme(gamme)) notFound();

  const gammeDef = getGammeDef(gamme);
  const kit = await getKitByCycleNiveauGamme(cycle, niveau, gamme);
  const retour = `/kits/${cycle}/${encodeURIComponent(niveau)}`;

  if (!kit) {
    return (
      <div className="animate-fade-in-up flex flex-1 flex-col items-center justify-center gap-3 px-6 py-24 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-brand/10 text-brand">
          <Package size={26} aria-hidden="true" />
        </span>
        <h1 className="font-heading text-lg font-semibold text-ink">
          Gamme {gammeDef?.label} indisponible
        </h1>
        <Link href={retour} className="text-sm font-medium text-brand">
          Voir les autres gammes
        </Link>
      </div>
    );
  }

  const items = await getKitItemsAvecProduits(kit.id);
  const sacParDefaut = (await getSacsDisponibles({ limit: 1 })).items[0] ?? null;

  return (
    <div className="animate-fade-in-up flex flex-col gap-1 py-4">
      <Link
        href={retour}
        className="mx-4 mb-1 inline-flex w-fit items-center gap-1 text-xs font-medium text-ink/60 transition-colors hover:text-ink"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Gammes du Kit {niveau}
      </Link>

      <div className="flex items-start justify-between gap-3 px-4">
        <h1 className="font-heading text-xl font-bold text-ink">
          Kit {niveau} · {gammeDef?.label}
        </h1>
        <ShareButton
          path={`/kits/${cycle}/${encodeURIComponent(niveau)}/${gamme}`}
          title={`Kit ${niveau} ${gammeDef?.label ?? ""}`.trim()}
          className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full border border-ink/15 text-ink/70 transition-transform active:scale-90"
          size={17}
        />
      </div>
      <p className="px-4 pb-2 text-sm text-ink/60">{gammeDef?.tagline}</p>

      <div className="mx-4 mb-2 flex items-center gap-2.5 rounded-2xl border border-decorative/30 bg-decorative/10 px-4 py-3">
        <BookOpen size={18} className="shrink-0 text-ink/70" aria-hidden="true" />
        <p className="text-xs text-ink/80">
          <span className="font-semibold">Ebook de la classe offert</span> à l&apos;achat de ce kit
          complet, quelle que soit la gamme.
        </p>
      </div>

      <p className="px-4 pb-2 text-xs text-ink/50">
        Liste pré-cochée : décochez ce que vous avez déjà, ajustez les quantités.
      </p>
      <KitBuilder
        kitNom={`${niveau} ${gammeDef?.label ?? ""}`.trim()}
        items={items}
        sacParDefaut={sacParDefaut}
      />
    </div>
  );
}
