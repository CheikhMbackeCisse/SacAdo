import type { MetadataRoute } from "next";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://sacado.sn").replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/vendeur",
        "/preparation",
        "/checkout",
        "/panier",
        "/moi",
        "/suivi",
        "/recherche",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
