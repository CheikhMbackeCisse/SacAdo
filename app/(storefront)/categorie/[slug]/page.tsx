import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getCategorieBySlug,
  getProduitsByCategorie,
  getSousCategoriesByCategorie,
  getSousSousCategoriesBySousCategories,
} from "@/lib/supabase/queries";
import { CategoryProductList } from "@/components/category/category-product-list";
import { DemanderProduit } from "@/components/demande/demander-produit";
import { origineSite } from "@/lib/site-url";
import { slugAvecId } from "@/lib/slug";
import { tronquer } from "@/lib/format";
import { breadcrumbJsonLd, itemListJsonLd, JsonLd } from "@/lib/seo/jsonld";

// ISR : la page est mise en cache par catégorie et régénérée au plus toutes
// les 2 min, pour ne pas taper Supabase à chaque visite du catalogue (c'est le
// gros du trafic public). Le filtre par sous-catégorie / sous-sous-catégorie
// (?sc=, ?ssc=) est appliqué côté client, sans casser ce cache.
export const revalidate = 120;

export async function generateMetadata(
  props: PageProps<"/categorie/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const categorie = await getCategorieBySlug(slug);
  if (!categorie || !categorie.actif || categorie.slug === "kits") return {};

  const site = await origineSite();
  const url = `${site}/categorie/${categorie.slug}`;
  const titre = tronquer(`${categorie.nom} | SacAdo`, 60);
  const description = tronquer(
    `${categorie.nom} : fournitures scolaires et matériel d'étude au meilleur prix, livrés partout au Sénégal.`,
    155,
  );

  // Canonical toujours vers l'URL nue : ?sc=/?ssc= ne doivent jamais être
  // indexés comme des pages à part (contenu dupliqué avec la page catégorie).
  return {
    title: titre,
    description,
    alternates: { canonical: url },
    openGraph: { title: categorie.nom, description, url, siteName: "SacAdo", locale: "fr_SN" },
    twitter: { card: "summary_large_image", title: categorie.nom, description },
  };
}

export default async function CategoriePage(props: PageProps<"/categorie/[slug]">) {
  const { slug } = await props.params;
  const categorie = await getCategorieBySlug(slug);
  // "kits" est une catégorie du référentiel mais son parcours est dédié (/kits).
  if (!categorie || !categorie.actif || categorie.slug === "kits") notFound();

  const [{ items: produits, hasMore, total }, sousCategories] = await Promise.all([
    getProduitsByCategorie(categorie.id),
    getSousCategoriesByCategorie(categorie.id),
  ]);
  // 3e niveau (optionnel) : chargé après coup, on connaît déjà les sous-catégories.
  const sousSousCategories = await getSousSousCategoriesBySousCategories(
    sousCategories.map((sc) => sc.id),
  );

  const site = await origineSite();
  const fil = [
    { nom: "Accueil", url: site },
    { nom: categorie.nom, url: `${site}/categorie/${categorie.slug}` },
  ];
  const items = produits.map((p) => ({
    nom: p.nom,
    url: `${site}/produits/${slugAvecId(p.nom, p.id)}`,
  }));

  return (
    <div className="animate-fade-in-up py-4">
      <JsonLd data={breadcrumbJsonLd(fil)} />
      {items.length > 0 && <JsonLd data={itemListJsonLd(items)} />}
      <h1 className="px-4 pb-3 font-heading text-xl font-bold text-ink">{categorie.nom}</h1>
      <Suspense fallback={null}>
        <CategoryProductList
          categorieId={categorie.id}
          categorieSlug={categorie.slug}
          produitsInitiaux={produits}
          hasMoreInitial={hasMore}
          totalInitial={total ?? produits.length}
          sousCategories={sousCategories}
          sousSousCategories={sousSousCategories}
        />
      </Suspense>
      <DemanderProduit origine="categorie" variante="discret" />
    </div>
  );
}
