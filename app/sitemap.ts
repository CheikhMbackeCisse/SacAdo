import type { MetadataRoute } from "next";
import { getCategories, getProduitsPubliesPourSitemap } from "@/lib/supabase/queries";
import { slugAvecId } from "@/lib/slug";
import { CYCLES } from "@/lib/cycles";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://sacado.sn").replace(/\/$/, "");

// Généré depuis la base à chaque requête du crawler (pas de fichier écrit à
// la main) : ne contient que les catégories actives et les produits publiés.
// Les URL à paramètre (?sc=, ?ssc=) ne figurent jamais ici (canonical vers la
// page nue, voir app/(storefront)/categorie/[slug]/page.tsx).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, produits] = await Promise.all([
    getCategories(),
    getProduitsPubliesPourSitemap(),
  ]);

  const entrees: MetadataRoute.Sitemap = [{ url: SITE_URL, changeFrequency: "daily", priority: 1 }];

  for (const categorie of categories) {
    // "kits" a son propre parcours dédié (/kits), pas de page /categorie/kits.
    if (categorie.slug === "kits") continue;
    entrees.push({
      url: `${SITE_URL}/categorie/${categorie.slug}`,
      lastModified: categorie.created_at,
      changeFrequency: "daily",
      priority: 0.7,
    });
  }

  for (const produit of produits) {
    // Pas de `lastModified` : `produits` n'a pas de colonne de dernière
    // modification (seulement `created_at`, qui daterait faussement chaque
    // mise à jour de prix/description). Champ optionnel dans la spec sitemap.
    entrees.push({
      url: `${SITE_URL}/produits/${slugAvecId(produit.nom, produit.id)}`,
      changeFrequency: "weekly",
      priority: 0.6,
    });
  }

  entrees.push({ url: `${SITE_URL}/kits`, changeFrequency: "weekly", priority: 0.6 });
  for (const cycle of CYCLES) {
    entrees.push({ url: `${SITE_URL}/kits/${cycle.value}`, changeFrequency: "weekly", priority: 0.5 });
    for (const classe of cycle.classes) {
      entrees.push({
        url: `${SITE_URL}/kits/${cycle.value}/${encodeURIComponent(classe)}`,
        changeFrequency: "weekly",
        priority: 0.5,
      });
    }
  }

  return entrees;
}
