import { HeroCarousel } from "@/components/home/hero-carousel";
import { CategoryScroll } from "@/components/home/category-scroll";
import { Feed } from "@/components/home/feed";
import { getAccueilFeed } from "@/lib/accueil";
import { getCategories } from "@/lib/supabase/queries";

// Rendu dynamique : le flux est personnalisé par visiteur (cookie `sacado_sid`
// -> affinité de session / compte / bénéficiaires). Le score reste calculé hors
// ligne ; ici on ne fait qu'un tri sur colonne indexée + une jointure par id.
export const dynamic = "force-dynamic";

// TACHE_correction_accueil.md : recherche (header) -> carrousel ->
// catégories -> produits Fournitures d'école. Rien d'autre : pas de bloc
// kits (déjà l'onglet central du bottom nav), pas de bandeau établissements
// (Impression et consommables reste accessible via la rangée de catégories
// et la recherche).
export default async function Home() {
  const [feed, categories] = await Promise.all([getAccueilFeed(20), getCategories()]);

  return (
    <div className="flex flex-col pb-6">
      <HeroCarousel />
      <CategoryScroll categories={categories} />
      <section className="mt-5">
        <h2 className="px-4 pb-3 font-heading text-base font-semibold text-ink">Fournitures scolaires</h2>
        <Feed feed={feed} />
      </section>
    </div>
  );
}
