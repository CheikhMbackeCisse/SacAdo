"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Slide = {
  title: string;
  subtitle: string;
  cta: string;
  href: string;
  // absent -> pas encore de vraie photo, on retombe sur un dégradé de marque.
  image?: string;
};

const SLIDES: Slide[] = [
  {
    title: "Tout ce qu'il vous faut pour la rentrée avec SacAdo",
    subtitle: "Pour chaque niveau, de la maternelle à l'université",
    cta: "Découvrir",
    href: "/categories",
    image: "/images/hero-marque.jpg",
  },
  {
    title: "Sa classe, son kit prêt à commander, ebook offert",
    subtitle: "Pour chaque kit complet acheté, 1 ebook offert",
    cta: "Composer mon kit",
    href: "/kits",
    image: "/images/cat-kits.png",
  },
  {
    title: "Vous commandez, on vous l'apporte",
    subtitle: "Partout au Sénégal, paiement à la réception",
    cta: "Commander",
    href: "/categories",
    image: "/images/hero-livraison.jpg",
  },
  {
    title: "Un endroit rien qu'à lui pour apprendre",
    subtitle: "Le bureau, la chaise, tout pour se concentrer",
    cta: "Aménager son espace",
    href: "/categorie/mobilier",
    image: "/images/hero-coin-etude.jpg",
  },
  {
    title: "Les outils du numérique à votre portée",
    subtitle: "Pour apprendre, créer et grandir avec le temps",
    cta: "Voir le matériel",
    href: "/categorie/ordinateurs",
    image: "/images/hero-informatique.jpg",
  },
];

const AUTO_SLIDE_MS = 4500;
// Un clone de la 1re slide est ajouté après la 5e : l'auto-rotation glisse
// dessus normalement, puis on se replace sur la vraie 1re slide sans
// animation une fois la transition finie -> boucle infinie sans saut visible.
const LOOP_SLIDES = [...SLIDES, SLIDES[0]];
const LAST_INDEX = LOOP_SLIDES.length - 1;
// Délai après le dernier évènement "scroll" avant de considérer la position
// stabilisée : lire scrollLeft PENDANT l'animation (au lieu d'attendre la fin)
// donnait un index intermédiaire qui annulait la transition en cours -> c'est
// ce qui bloquait l'auto-rotation.
const SCROLL_SETTLE_MS = 120;

// `active` = l'accueil est à l'écran. Le composant reste monté en permanence
// (rendu dans le layout, masqué en `display:none` ailleurs) pour que les images
// ne soient JAMAIS rechargées ni re-animées au retour sur l'accueil. Quand il
// est masqué, on coupe l'auto-rotation et on remet la 1re slide sans animation.
export function HeroCarousel({ active = true }: { active?: boolean }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackIndex, setTrackIndex] = useState(0);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!active) return;
    // Le nœud du carrousel ne change pas de toute la vie du composant.
    const track = trackRef.current;
    const id = setInterval(() => {
      setTrackIndex((current) => Math.min(current + 1, LAST_INDEX));
    }, AUTO_SLIDE_MS);
    return () => {
      clearInterval(id);
      // En quittant l'accueil (le composant reste monté, juste masqué) : retour
      // instantané à la 1re slide, sans scroll animé. Au prochain affichage le
      // carrousel repart proprement du début, images déjà en cache.
      setTrackIndex(0);
      track?.scrollTo({ left: 0, behavior: "auto" });
    };
  }, [active]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: trackIndex * track.clientWidth, behavior: "smooth" });
  }, [trackIndex]);

  useEffect(() => () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
  }, []);

  return (
    <div className="px-4 pt-3">
      <div
        ref={trackRef}
        onScroll={(event) => {
          const track = event.currentTarget;
          if (settleTimer.current) clearTimeout(settleTimer.current);
          settleTimer.current = setTimeout(() => {
            const settledIndex = Math.round(track.scrollLeft / track.clientWidth);
            if (settledIndex === LAST_INDEX) {
              // Le clone de la 1re slide est identique à la vraie : le saut
              // instantané est invisible pour l'œil.
              track.scrollTo({ left: 0, behavior: "auto" });
              setTrackIndex(0);
            } else {
              setTrackIndex(settledIndex);
            }
          }, SCROLL_SETTLE_MS);
        }}
        className="flex snap-x snap-mandatory overflow-x-auto rounded-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {LOOP_SLIDES.map((slide, i) => (
          <div
            key={i}
            className="relative flex min-h-[18rem] w-full shrink-0 snap-center flex-col justify-end overflow-hidden bg-black sm:min-h-[22rem] lg:min-h-[26rem]"
          >
            {slide.image ? (
              <Image
                src={slide.image}
                alt={slide.title}
                fill
                // Seule la 1re slide est prioritaire (LCP), et seulement quand
                // l'accueil est affiché — sinon on préchargerait cette image sur
                // toutes les pages du site.
                priority={active && i === 0}
                sizes="100vw"
                className="object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-brand to-ink" />
            )}
            {/* Voile sombre : le titre reste lisible quelle que soit la photo
                (zone claire ou chargée), sans dépendre de l'illustration. */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/10" />

            <div className="relative flex flex-col gap-2 px-6 py-7 text-white">
              {/* clamp() : le texte rétrécit avec l'écran au lieu d'être tronqué
                  — titre et sous-titre restent toujours affichés en entier. */}
              <h2 className="max-w-[34ch] font-heading text-[clamp(1.05rem,4.5vw,1.9rem)] font-extrabold leading-tight drop-shadow-sm sm:max-w-lg">
                {slide.title}
              </h2>
              <p className="max-w-[40ch] text-[clamp(0.8rem,3vw,1rem)] text-white/85">
                {slide.subtitle}
              </p>
              <Link
                href={slide.href}
                className="mt-1 inline-flex w-fit items-center rounded-full bg-action px-4 py-2 text-sm font-semibold text-on-action transition-transform active:scale-95"
              >
                {slide.cta}
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
