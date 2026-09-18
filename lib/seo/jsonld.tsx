import type { Produit } from "@/lib/supabase/types";
import { urlAbsolue } from "@/lib/site-url";

// Données structurées JSON-LD (TACHE_migration_sacado_sn_et_seo.md, partie
// 3.4). Aucune donnée d'avis/note : le catalogue n'a aucun avis client réel,
// en inventer serait un balisage frauduleux (règle explicite du chantier).

type Disponibilite = "https://schema.org/InStock" | "https://schema.org/PreOrder" | "https://schema.org/OutOfStock";

function disponibilite(statut: Produit["statut"]): Disponibilite {
  if (statut === "dispo") return "https://schema.org/InStock";
  if (statut === "sur_commande") return "https://schema.org/PreOrder";
  return "https://schema.org/OutOfStock";
}

export function produitJsonLd({
  produit,
  url,
  site,
}: {
  produit: Produit;
  url: string;
  site: string;
}) {
  const brutes = produit.photos.length > 0 ? produit.photos : produit.photo ? [produit.photo] : [];
  const images = brutes.map((chemin) => urlAbsolue(site, chemin));
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: produit.nom,
    image: images,
    description: produit.description ?? produit.nom,
    sku: String(produit.id),
    // Décision explicite : jamais de repli "SacAdo" — une marque non
    // renseignée en base n'est pas émise du tout (éviter un signal de marque
    // faux sur des centaines de produits génériques).
    ...(produit.marque ? { brand: { "@type": "Brand", name: produit.marque } } : {}),
    offers: {
      "@type": "Offer",
      price: String(produit.prix),
      priceCurrency: "XOF",
      availability: disponibilite(produit.statut),
      url,
      seller: { "@type": "Organization", name: "SacAdo" },
    },
  };
}

export function breadcrumbJsonLd(items: { nom: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.nom,
      item: item.url,
    })),
  };
}

export function itemListJsonLd(items: { nom: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.nom,
      url: item.url,
    })),
  };
}

export function organizationJsonLd({ siteUrl, whatsappE164 }: { siteUrl: string; whatsappE164: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "SacAdo",
    url: siteUrl,
    logo: `${siteUrl}/images/logo.jpg`,
    contactPoint: {
      "@type": "ContactPoint",
      telephone: whatsappE164,
      contactType: "customer service",
      areaServed: "SN",
      availableLanguage: "French",
    },
  };
}

export function websiteJsonLd({ siteUrl }: { siteUrl: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "SacAdo",
    url: siteUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteUrl}/recherche?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

// `<` échappé : un nom de produit contenant "</script>" ne doit pas pouvoir
// casser le tag qui porte le JSON-LD.
export function JsonLd({ data }: { data: object }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
