import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { ADMIN_URL, SITE_URL } from "@/lib/site";

const ADMIN_HOST = new URL(ADMIN_URL).hostname;

export default async function robots(): Promise<MetadataRoute.Robots> {
  // admin.sacado.sn ne doit JAMAIS être exploré (TACHE_admin_sous_domaine.md
  // Phase 5) : interdiction totale, pas de sitemap pour cette origine.
  const h = await headers();
  const hostname = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(":")[0].toLowerCase();
  if (hostname === ADMIN_HOST) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

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
