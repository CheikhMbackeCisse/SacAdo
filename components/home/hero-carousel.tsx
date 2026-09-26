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
  // Miniature floue en base64 (générée avec sharp) : affichée pendant le
  // chargement de la vraie image, plus d'à-coup visuel.
  blur?: string;
};

const SLIDES: Slide[] = [
  {
    title: "Tout ce qu'il vous faut pour la rentrée avec SacAdo",
    subtitle: "Pour chaque niveau, de la maternelle à l'université",
    cta: "Découvrir",
    href: "/categories",
    image: "/images/hero-marque.jpg",
    blur: "data:image/webp;base64,UklGRkQAAABXRUJQVlA4IDgAAADwAQCdASoMAAwAA4BaJbACdAELz4SBaYAA/vPIifajCzd3NzQnnTdUL/7XnNJqPoKhGy0h7XEwAA==",
  },
  {
    title: "Sa classe, son kit prêt à commander",
    subtitle: "Une liste ajustable, livrée partout au Sénégal",
    cta: "Composer mon kit",
    href: "/kits",
    image: "/images/cat-kits.png",
    blur: "data:image/webp;base64,UklGRj4AAABXRUJQVlA4IDIAAADQAQCdASoMAAoAA4BaJYgCdAD0dnQ9AAD+7lf5cLg8/AOmW/3kXPx1q+qNDT+N7/oAAA==",
  },
  {
    title: "Vous commandez, on vous l'apporte",
    subtitle: "Livré partout au Sénégal, en 24h ou 6 jours",
    cta: "Commander",
    href: "/categories",
    image: "/images/hero-livraison.jpg",
    blur: "data:image/webp;base64,UklGRjwAAABXRUJQVlA4IDAAAADQAQCdASoMAAgAA4BaJYgCdACRpiZ4AAD9+X8xX/Ht9OCqxPQZ+MUQhVEqTCQgwAA=",
  },
  {
    title: "Un endroit rien qu'à lui pour apprendre",
    subtitle: "Le bureau, la chaise, tout pour se concentrer",
    cta: "Aménager son espace",
    href: "/categorie/mobilier",
    image: "/images/hero-coin-etude.jpg",
    blur: "data:image/webp;base64,UklGRj4AAABXRUJQVlA4IDIAAADwAQCdASoMAAwAA4BaJQBOgBuKByxGGAAA/uc/GVE9IjhUEjVZ0PyNy5wtubrZO/WAAA==",
  },
  {
    title: "Les outils du numérique à votre portée",
    subtitle: "Pour apprendre, créer et grandir avec le temps",
    cta: "Voir le matériel",
    href: "/categorie/ordinateurs",
    image: "/images/hero-informatique.jpg",
    blur: "data:image/webp;base64,UklGRkQAAABXRUJQVlA4IDgAAADwAQCdASoMAAcAA4BaJQBOgBuEXyQ24AAA/vCugYXuDrm2HYrgN1yXXbhcVSoKNMl5bS08KQAAAA==",
  },
];

// TACHE_nettoyage_carrousel_preferences.md §B2 : 3500 ms, sinon trop rapide
// pour certains, trop lent pour tenir en haleine les autres.
const AUTO_SLIDE_MS = 3500;
// Durée max de la transition programmatique (glissement auto ou clic sur une
// pastille) : une transition lente mange le temps de lecture (§B2).
const TRANSITION_MS = 400;
// Un clone de la 1re slide est ajouté après la 5e : l'auto-rotation glisse
// dessus normalement, puis on se replace sur la vraie 1re slide sans
// animation une fois la transition finie -> boucle infinie sans saut visible.
const LOOP_SLIDES = [...SLIDES, SLIDES[0]];
const LAST_INDEX = LOOP_SLIDES.length - 1;
// Délai après le dernier évènement "scroll" avant de considérer la position
// stabilisée : lire scrollLeft PENDANT un swipe donnerait un index
// intermédiaire et ferait sauter le glissement natif de l'utilisateur.
const SCROLL_SETTLE_MS = 120;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function HeroCarousel() {
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackIndex, setTrackIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [reduitMotion, setReduitMotion] = useState(false);
  // Refs (pas de re-render) : lues dans les timers/observers/handlers.
  const arreteDefinitivement = useRef(false);
  const reduireAnimations = useRef(false);
  const animationFrame = useRef<number | null>(null);
  const programmatique = useRef(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Défilement programmatique borné à TRANSITION_MS (le swipe tactile natif,
  // lui, n'est pas concerné — seul ce défilement scripté doit rester court).
  const allerA = (index: number, instantane = false) => {
    const track = trackRef.current;
    if (!track) return;
    if (animationFrame.current) cancelAnimationFrame(animationFrame.current);

    const cible = index * track.clientWidth;
    if (instantane || reduireAnimations.current) {
      programmatique.current = true;
      track.scrollLeft = cible;
      programmatique.current = false;
      return;
    }

    const depart = track.scrollLeft;
    const distance = cible - depart;
    const debut = performance.now();
    programmatique.current = true;

    const etape = (maintenant: number) => {
      const t = Math.min(1, (maintenant - debut) / TRANSITION_MS);
      track.scrollLeft = depart + distance * easeOutCubic(t);
      if (t < 1) {
        animationFrame.current = requestAnimationFrame(etape);
      } else {
        programmatique.current = false;
        animationFrame.current = null;
      }
    };
    animationFrame.current = requestAnimationFrame(etape);
  };

  // Réglage système de réduction des animations : pas de défilement auto du
  // tout (§B2).
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const appliquer = () => {
      reduireAnimations.current = media.matches;
      setReduitMotion(media.matches);
    };
    appliquer();
    media.addEventListener("change", appliquer);
    return () => media.removeEventListener("change", appliquer);
  }, []);

  // Le carrousel ne tourne pas quand il est hors de l'écran (économie de
  // batterie, personne ne le regarde) — §B2.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      threshold: 0.25,
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || reduitMotion) return;
    const id = setInterval(() => {
      if (arreteDefinitivement.current) return;
      setTrackIndex((current) => Math.min(current + 1, LAST_INDEX));
    }, AUTO_SLIDE_MS);
    return () => clearInterval(id);
  }, [visible, reduitMotion]);

  useEffect(() => {
    allerA(trackIndex);
  }, [trackIndex]);

  useEffect(
    () => () => {
      if (animationFrame.current) cancelAnimationFrame(animationFrame.current);
      if (settleTimer.current) clearTimeout(settleTimer.current);
    },
    [],
  );

  // Un balayage, un clic, un appui = l'utilisateur prend la main : le
  // défilement automatique s'arrête définitivement, il ne redémarre pas (§B2).
  const arreter = () => {
    arreteDefinitivement.current = true;
  };

  return (
    <div ref={rootRef} className="px-4 pt-3">
      <div
        ref={trackRef}
        onPointerDown={arreter}
        onWheel={arreter}
        onScroll={(event) => {
          // Ignorer les scrolls déclenchés par notre propre animation : seul
          // un scroll natif (swipe, molette) doit couper l'auto-rotation via
          // onPointerDown/onWheel ci-dessus.
          if (programmatique.current) return;
          const track = event.currentTarget;
          if (settleTimer.current) clearTimeout(settleTimer.current);
          settleTimer.current = setTimeout(() => {
            const settledIndex = Math.round(track.scrollLeft / track.clientWidth);
            if (settledIndex === LAST_INDEX) {
              // Le clone de la 1re slide est identique à la vraie : le saut
              // instantané est invisible pour l'œil.
              programmatique.current = true;
              track.scrollLeft = 0;
              programmatique.current = false;
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
            className="relative flex min-h-[18rem] w-full shrink-0 snap-center flex-col justify-end overflow-hidden bg-black sm:min-h-[21.6rem] lg:min-h-[25.2rem]"
          >
            {slide.image ? (
              <Image
                src={slide.image}
                alt={slide.title}
                fill
                // Les 5 vraies slides sont préchargées (vues tout de suite au
                // défilement auto). La 6e est le clone de la 1re, déjà chargée.
                priority={i < SLIDES.length}
                sizes="100vw"
                placeholder={slide.blur ? "blur" : "empty"}
                blurDataURL={slide.blur}
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
                onClick={arreter}
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
