import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Package } from "lucide-react";
import { getCycleByValue } from "@/lib/cycles";
import { getGammeDef, isGamme } from "@/lib/gammes";
import {
  getKitByCycleNiveauGamme,
  getKitItemsAvecProduits,
  getVariantesByProduitIds,
} from "@/lib/supabase/queries";
import { KitBuilder, type LigneKitBuilder } from "@/components/kits/kit-builder";
import { ProductImage } from "@/components/ui/product-image";
import { ShareButton } from "@/components/ui/share-button";
import { origineSite } from "@/lib/site-url";
import { tronquer } from "@/lib/format";
import {
  aUneCleDesCracksAffichable,
  estClasseKitValide,
  kitEstAffichable,
  ligneEstAffichable,
  type LigneKit,
} from "@/lib/kits";

export const revalidate = 120;

export async function generateMetadata(
  props: PageProps<"/kits/[cycle]/[niveau]/[gamme]">,
): Promise<Metadata> {
  const { cycle, niveau: niveauParam, gamme } = await props.params;
  const niveau = decodeURIComponent(niveauParam);
  const cycleDef = getCycleByValue(cycle);
  if (!cycleDef || !estClasseKitValide(cycle, niveau) || !isGamme(gamme)) return {};

  const gammeDef = getGammeDef(gamme);
  const site = await origineSite();
  const url = `${site}/kits/${cycle}/${encodeURIComponent(niveau)}/${gamme}`;
  const titre = tronquer(`Kit scolaire ${niveau} — ${gammeDef?.label ?? ""} | SacAdo`, 60);
  const description = tronquer(
    `Kit scolaire complet pour ${niveau}, gamme ${gammeDef?.label ?? ""} : liste ajustable, livraison partout au Sénégal.`,
    155,
  );

  return {
    title: titre,
    description,
    alternates: { canonical: url },
    openGraph: { title: titre, description, url, siteName: "SacAdo", locale: "fr_SN" },
    twitter: { card: "summary_large_image", title: titre, description },
  };
}

export default async function KitGammePage(props: PageProps<"/kits/[cycle]/[niveau]/[gamme]">) {
  const { cycle, niveau: niveauParam, gamme } = await props.params;
  const niveau = decodeURIComponent(niveauParam);
  const cycleDef = getCycleByValue(cycle);
  if (!cycleDef || !estClasseKitValide(cycle, niveau) || !isGamme(gamme)) notFound();

  const gammeDef = getGammeDef(gamme);
  const kit = await getKitByCycleNiveauGamme(cycle, niveau, gamme);
  const retour = `/kits/${cycle}/${encodeURIComponent(niveau)}`;

  const items = kit ? await getKitItemsAvecProduits(kit.id) : [];
  const lignesKit: LigneKit[] = items.map((it) => ({ item: it, produit: it.produit }));

  if (!kit || !kitEstAffichable(lignesKit)) {
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

  const variantesParProduit = await getVariantesByProduitIds(items.map((it) => it.produit.id));
  const description =
    !aUneCleDesCracksAffichable(lignesKit) && kit.description_si_aucune_cle_des_cracks
      ? kit.description_si_aucune_cle_des_cracks
      : kit.description;

  const lignes: LigneKitBuilder[] = items
    .filter((it) => ligneEstAffichable(it.produit))
    .map((it) => ({
      id: it.id,
      produit: it.produit,
      quantite: it.quantite_defaut,
      libelleBesoin: it.libelle_besoin,
      groupeAffichage: it.groupe_affichage,
      section: it.section,
      cocheDefaut: it.coche_defaut,
      ordre: it.ordre,
      variantes: variantesParProduit.get(it.produit.id) ?? [],
    }));

  // Visuel du kit : mosaïque d'au plus 4 photos déjà publiées (jamais générée) —
  // Étape 4 du prompt.
  const photosMosaique = [
    ...new Set(lignes.filter((l) => l.section === "principal").map((l) => l.produit.photo)),
  ]
    .filter((p): p is string => !!p)
    .slice(0, 4);

  return (
    <div className="animate-fade-in-up flex flex-col gap-1 py-4">
      <Link
        href={retour}
        className="mx-4 mb-1 inline-flex w-fit items-center gap-1 text-xs font-medium text-ink/60 transition-colors hover:text-ink"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Gammes du Kit {niveau}
      </Link>

      {photosMosaique.length > 0 ? (
        <div className="mx-4 mb-1 grid aspect-[2/1] grid-cols-2 gap-1 overflow-hidden rounded-2xl">
          {photosMosaique.map((photo) => (
            <div key={photo} className="relative bg-elevated">
              <ProductImage src={photo} alt="" className="h-full w-full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="mx-4 mb-1 flex aspect-[2/1] flex-col items-center justify-center gap-1 rounded-2xl bg-brand/10">
          <span className="font-heading text-lg font-bold text-brand">{niveau}</span>
          <span className="text-sm text-brand/70">{gammeDef?.label}</span>
        </div>
      )}

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
      {description && <p className="mx-4 mb-1 mt-1 text-sm text-ink/70">{description}</p>}

      <KitBuilder
        kitNom={`${niveau} ${gammeDef?.label ?? ""}`.trim()}
        cycle={cycle}
        niveau={niveau}
        lignes={lignes}
      />
    </div>
  );
}
