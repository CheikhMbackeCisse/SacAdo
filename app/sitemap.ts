import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import {
  getCategories,
  getClassesActives,
  getClassesLyceeAvecKits,
  getProduitsPubliesPourSitemap,
} from "@/lib/supabase/queries";
import { slugAvecId } from "@/lib/slug";
import { CYCLES } from "@/lib/cycles";
import { ADMIN_URL, SITE_URL } from "@/lib/site";

const ADMIN_HOST = new URL(ADMIN_URL).hostname;

// Généré depuis la base à chaque requête du crawler (pas de fichier écrit à
// la main) : ne contient que les catégories actives et les produits publiés.
// Les URL à paramètre (?sc=, ?ssc=) ne figurent jamais ici (canonical vers la
// page nue, voir app/(storefront)/categorie/[slug]/page.tsx).
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // admin.sacado.sn n'est jamais indexé (voir robots.ts) : sitemap vide,
  // inutile d'interroger la base pour cette origine.
  const h = await headers();
  const hostname = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(":")[0].toLowerCase();
  if (hostname === ADMIN_HOST) {
    return [];
  }

  const [categories, produits, classesLyceeDb, toutesLesClasses] = await Promise.all([
    getCategories(),
    getProduitsPubliesPourSitemap(),
    getClassesLyceeAvecKits(),
    getClassesActives(),
  ]);
  const classesLyceeAvecKits = new Set(classesLyceeDb);
  const classesParCycle = new Map<string, string[]>();
  for (const c of toutesLesClasses) {
    classesParCycle.set(c.cycle, [...(classesParCycle.get(c.cycle) ?? []), c.classe]);
  }

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
    // Classes en base (migration 0099, ADMIN.md Lot 3). Le lycée ne liste que
    // les classes qui ont réellement un kit publié (CORRECTIONS_V12 Lot 2).
    const classesDuCycle = classesParCycle.get(cycle.value) ?? [];
    const classes =
      cycle.value === "lycee" ? classesDuCycle.filter((c) => classesLyceeAvecKits.has(c)) : classesDuCycle;
    for (const classe of classes) {
      entrees.push({
        url: `${SITE_URL}/kits/${cycle.value}/${encodeURIComponent(classe)}`,
        changeFrequency: "weekly",
        priority: 0.5,
      });
    }
  }

  return entrees;
}
