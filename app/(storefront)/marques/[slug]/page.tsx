import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMarqueBySlug, getProduitsByMarque } from "@/lib/supabase/queries";
import { logoMarque } from "@/lib/marques";
import { MarqueProductList } from "@/components/marque/marque-product-list";
import { origineSite } from "@/lib/site-url";
import { tronquer } from "@/lib/format";

export const revalidate = 300;

export async function generateMetadata(props: PageProps<"/marques/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const marque = await getMarqueBySlug(slug);
  if (!marque) return {};
  const site = await origineSite();
  return {
    title: tronquer(`${marque} | SacAdo`, 60),
    description: tronquer(`Tous les produits ${marque} disponibles sur SacAdo, livrés partout au Sénégal.`, 155),
    alternates: { canonical: `${site}/marques/${slug}` },
  };
}

export default async function MarquePage(props: PageProps<"/marques/[slug]">) {
  const { slug } = await props.params;
  const marque = await getMarqueBySlug(slug);
  if (!marque) notFound();

  const { items: produits, hasMore, total } = await getProduitsByMarque(marque);
  const logo = logoMarque(marque);

  return (
    <div className="animate-fade-in-up py-4">
      <div className="mb-4 flex items-center gap-3 px-4">
        {logo && <Image src={logo} alt={marque} width={120} height={40} className="h-9 w-auto object-contain" />}
        <h1 className="font-heading text-xl font-bold text-ink">{marque}</h1>
      </div>
      <MarqueProductList
        marque={marque}
        produitsInitiaux={produits}
        hasMoreInitial={hasMore}
        totalInitial={total ?? produits.length}
      />
    </div>
  );
}
