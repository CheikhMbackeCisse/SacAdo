import { HeroCarousel } from "@/components/home/hero-carousel";
import { CategoryScroll } from "@/components/home/category-scroll";
import { BandeauEtablissement } from "@/components/home/bandeau-etablissement";
import { Feed } from "@/components/home/feed";
import { getAccueilFeed } from "@/lib/accueil";
import { getCategories } from "@/lib/supabase/queries";

// Rendu dynamique : le flux est personnalisé par visiteur (cookie `sacado_sid`
// -> affinité de session / compte / bénéficiaires). Le score reste calculé hors
// ligne ; ici on ne fait qu'un tri sur colonne indexée + une jointure par id.
export const dynamic = "force-dynamic";

export default async function Home() {
  const [feed, categoriesToutes] = await Promise.all([getAccueilFeed(20), getCategories()]);
  // "Impression et consommables" s'adresse aux établissements, pas au flux
  // grand public : hors de la grille, accessible via le bandeau dédié.
  const categories = categoriesToutes.filter((c) => c.slug !== "impression-consommables");

  return (
    <div className="flex flex-col pb-6">
      <HeroCarousel />
      <CategoryScroll categories={categories} />
      <BandeauEtablissement />
      <section className="mt-4">
        <h2 className="px-4 pb-3 font-heading text-base font-semibold text-ink">À découvrir</h2>
        <Feed feed={feed} />
      </section>
    </div>
  );
}
