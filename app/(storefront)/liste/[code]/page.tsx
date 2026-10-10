import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListChecks } from "lucide-react";
import { getListeParCode, getListeItemsAvecProduits, getVariantesByProduitIds } from "@/lib/supabase/queries";
import { ligneEstAffichable } from "@/lib/kits";
import { ListeBuilder, type LigneListeBuilder } from "@/components/liste/liste-builder";
import { ShareButton } from "@/components/ui/share-button";
import { origineSite } from "@/lib/site-url";
import { tronquer } from "@/lib/format";

export const revalidate = 120;

export async function generateMetadata(
  props: PageProps<"/liste/[code]">,
): Promise<Metadata> {
  const { code } = await props.params;
  const liste = await getListeParCode(code);
  if (!liste) return {};

  const site = await origineSite();
  const url = `${site}/liste/${code}`;
  const titre = tronquer(`${liste.titre} | SacAdo`, 60);
  const description = tronquer(
    liste.description ?? `Liste de fournitures « ${liste.titre} », ajustable, livraison partout au Sénégal.`,
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

export default async function ListePubliquePage(props: PageProps<"/liste/[code]">) {
  const { code } = await props.params;
  const liste = await getListeParCode(code);
  if (!liste) notFound();

  const items = await getListeItemsAvecProduits(liste.id);
  const itemsAffichables = items.filter((it) => ligneEstAffichable(it.produit));

  if (itemsAffichables.length === 0) {
    return (
      <div className="animate-fade-in-up flex flex-1 flex-col items-center justify-center gap-3 px-6 py-24 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-brand/10 text-brand">
          <ListChecks size={26} aria-hidden="true" />
        </span>
        <h1 className="font-heading text-lg font-semibold text-ink">Liste indisponible</h1>
        <p className="text-sm text-ink/60">Cette liste ne contient plus d&apos;article disponible.</p>
      </div>
    );
  }

  const variantesParProduit = await getVariantesByProduitIds(itemsAffichables.map((it) => it.produit.id));

  const lignes: LigneListeBuilder[] = itemsAffichables.map((it) => ({
    id: it.id,
    produit: it.produit,
    quantiteDefaut: it.quantite_defaut,
    cocheDefaut: it.coche_defaut,
    ordre: it.ordre,
    variantes: variantesParProduit.get(it.produit.id) ?? [],
  }));

  return (
    <div className="animate-fade-in-up flex flex-col gap-1 py-4">
      <div className="flex items-start justify-between gap-3 px-4">
        <div className="flex flex-col gap-0.5">
          <span className="flex w-fit items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-1 text-[11px] font-semibold text-brand">
            <ListChecks size={13} aria-hidden="true" />
            Liste de fournitures
          </span>
          <h1 className="font-heading text-xl font-bold text-ink">{liste.titre}</h1>
        </div>
        <ShareButton
          path={`/liste/${liste.code}`}
          title={liste.titre}
          className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full border border-ink/15 text-ink/70 transition-transform active:scale-90"
          size={17}
        />
      </div>
      {liste.description && <p className="mx-4 mb-1 mt-1 text-sm text-ink/70">{liste.description}</p>}

      <ListeBuilder listeId={liste.id} code={liste.code} titre={liste.titre} lignes={lignes} />
    </div>
  );
}
