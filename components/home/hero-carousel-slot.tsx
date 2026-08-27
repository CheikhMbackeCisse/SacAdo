"use client";

import { usePathname } from "next/navigation";
import { HeroCarousel } from "./hero-carousel";

// Le hero vit dans le layout, pas dans la page d'accueil : ainsi il n'est jamais
// démonté quand on navigue vers une autre page puis qu'on revient. On le masque
// simplement (`display:none`) hors de l'accueil. Résultat : au retour, les
// images sont déjà chargées et l'animation ne « repart » pas de zéro.
export function HeroCarouselSlot() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <div className={isHome ? undefined : "hidden"} aria-hidden={!isHome}>
      <HeroCarousel active={isHome} />
    </div>
  );
}
