import { HeroCarousel } from "@/components/home/hero-carousel";
import { CategoryScroll } from "@/components/home/category-scroll";
import { Feed } from "@/components/home/feed";
import { BandeauPromoExpress } from "@/components/home/bandeau-promo-express";
import { getCategories } from "@/lib/supabase/queries";
import { FondDecor } from "@/components/ui/fond-decor";

// Page servie depuis le cache CDN (ISR) : aucune requête Supabase au moment
// de la visite. Le flux "À découvrir" est personnalisé par visiteur (cookie
// `sacado_sid`), donc chargé côté navigateur après l'affichage par <Feed />
// (voir components/home/feed.tsx) plutôt que rendu ici.
export const revalidate = 300;

export default async function Home() {
  const categories = await getCategories();

  return (
    <div className="flex flex-col pb-6">
      <FondDecor variante="general" />
      <BandeauPromoExpress />
      <HeroCarousel />
      <CategoryScroll categories={categories} />
      <h1 className="sr-only">
        Fournitures scolaires et kits scolaires à Dakar et partout au Sénégal
      </h1>
      <section className="mt-2">
        <h2 className="px-4 pb-3 font-heading text-base font-semibold text-ink">À découvrir</h2>
        <Feed />
      </section>
    </div>
  );
}
