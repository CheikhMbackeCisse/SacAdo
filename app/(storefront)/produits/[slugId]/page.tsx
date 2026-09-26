import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import {
  getAutresEditions,
  getCategorieById,
  getCompositionKit,
  getDocumentsApercu,
  getProduitById,
  getProduitsSimilaires,
  getVariantesByProduit,
} from "@/lib/supabase/queries";
import { getRedirectionEquivalent } from "@/lib/supabase/redirection-produit";
import { ProductDetail } from "@/components/product/product-detail";
import { ProductGrid } from "@/components/product/product-grid";
import { origineSite } from "@/lib/site-url";
import { idDepuisSlug, slugAvecId } from "@/lib/slug";
import { formatPrice, tronquer } from "@/lib/format";
import { breadcrumbJsonLd, produitJsonLd, JsonLd } from "@/lib/seo/jsonld";

// ISR : évite de retaper Supabase à chaque visite d'une fiche produit (trafic
// public le plus fréquent après le catalogue).
export const revalidate = 120;

async function chargerProduit(slugId: string) {
  const id = idDepuisSlug(slugId);
  if (id === null) notFound();
  const produit = await getProduitById(id);
  if (!produit) {
    const cible = await getRedirectionEquivalent(id);
    if (cible) permanentRedirect(`/produits/${slugAvecId(cible.nom, cible.id)}`);
    notFound();
  }

  // Slug périmé (produit renommé) ou vieux lien purement numérique : on
  // redirige en 301 vers la forme canonique plutôt que de servir deux URL
  // pour la même fiche (dilution du référencement).
  const canonique = slugAvecId(produit.nom, produit.id);
  if (slugId !== canonique) permanentRedirect(`/produits/${canonique}`);

  return produit;
}

function descriptionProduit(produit: Awaited<ReturnType<typeof getProduitById>>, categorieNom: string | null): string {
  if (!produit) return "";
  const base = produit.description?.trim();
  if (base && base.length >= 40) return tronquer(base, 155);
  const delai = produit.delai === "24h" ? "Livraison en 24h" : "Livraison en 6 jours";
  const gabarit = `${produit.nom}${categorieNom ? ` (${categorieNom})` : ""} — ${formatPrice(produit.prix)}. ${delai}, partout au Sénégal.`;
  return tronquer(gabarit, 155);
}

export async function generateMetadata(props: PageProps<"/produits/[slugId]">): Promise<Metadata> {
  const { slugId } = await props.params;
  const id = idDepuisSlug(slugId);
  if (id === null) return {};
  const produit = await getProduitById(id);
  if (!produit) return {};

  const canonique = slugAvecId(produit.nom, produit.id);
  const site = await origineSite();
  const url = `${site}/produits/${canonique}`;
  const categorie = await getCategorieById(produit.categorie_id);
  const titre = tronquer(`${produit.nom} — ${formatPrice(produit.prix)} | SacAdo`, 60);
  const description = descriptionProduit(produit, categorie?.nom ?? null);
  // Route dédiée (pas la convention opengraph-image.tsx, qui ne sort que du
  // PNG sans perte — beaucoup trop lourd avec une vraie photo produit, voir
  // og/route.ts) : JPEG compressé sous 300 Ko, à référencer explicitement ici.
  const imageOg = `${url}/og`;

  return {
    title: titre,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: produit.nom,
      description,
      url,
      siteName: "SacAdo",
      locale: "fr_SN",
      images: [{ url: imageOg, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: produit.nom,
      description,
      images: [imageOg],
    },
  };
}

export default async function ProduitPage(props: PageProps<"/produits/[slugId]">) {
  const { slugId } = await props.params;
  const produit = await chargerProduit(slugId);

  const [variantes, similaires, categorie, autresEditions, composantsKit, documents] = await Promise.all([
    getVariantesByProduit(produit.id),
    getProduitsSimilaires(produit.categorie_id, produit.id),
    getCategorieById(produit.categorie_id),
    produit.ouvrage_id ? getAutresEditions(produit.ouvrage_id, produit.id) : Promise.resolve([]),
    produit.est_kit ? getCompositionKit(produit.id) : Promise.resolve([]),
    produit.est_kit ? getDocumentsApercu(produit.id) : Promise.resolve([]),
  ]);

  const site = await origineSite();
  const url = `${site}/produits/${slugAvecId(produit.nom, produit.id)}`;
  const fil = [
    { nom: "Accueil", url: site },
    ...(categorie ? [{ nom: categorie.nom, url: `${site}/categorie/${categorie.slug}` }] : []),
    { nom: produit.nom, url },
  ];

  return (
    <div className="animate-fade-in-up flex flex-col gap-6 pb-8">
      {/* og:type n'a pas de littéral "product" dans le typage Metadata de
          Next : posé ici en balise brute, Next la remonte dans <head>. */}
      <meta property="og:type" content="product" />
      <JsonLd data={produitJsonLd({ produit, url, site })} />
      <JsonLd data={breadcrumbJsonLd(fil)} />

      <ProductDetail
        produit={produit}
        variantes={variantes}
        categorieNom={categorie?.nom ?? null}
        autresEditions={autresEditions}
        composantsKit={composantsKit}
        documents={documents}
      />

      {similaires.length > 0 && (
        <section>
          <h2 className="px-4 pb-3 font-heading text-base font-semibold text-ink">
            Vous aimerez aussi
          </h2>
          <ProductGrid produits={similaires} />
        </section>
      )}
    </div>
  );
}
