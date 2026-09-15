import { HeroCarousel } from "@/components/home/hero-carousel";
import { CategoryScroll } from "@/components/home/category-scroll";
import { Feed } from "@/components/home/feed";
import { getAccueilFeed } from "@/lib/accueil";
import { getCategories } from "@/lib/supabase/queries";

// Rendu dynamique : le flux est personnalisé par visiteur (cookie `sacado_sid`
// -> affinité de session / compte / bénéficiaires). Le score reste calculé hors
// ligne ; ici on ne fait qu'un tri sur colonne indexée + une jointure par id.
export const dynamic = "force-dynamic";

export default async function Home() {
  const [feed, categories] = await Promise.all([getAccueilFeed(20), getCategories()]);

  return (
    <div className="flex flex-col pb-6">
      <HeroCarousel />
      <CategoryScroll categories={categories} />
      <section className="mt-4">
        <h2 className="px-4 pb-3 font-heading text-base font-semibold text-ink">À découvrir</h2>
        <Feed feed={feed} />
      </section>
    </div>
  );
}
