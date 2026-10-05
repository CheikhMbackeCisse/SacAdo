"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ProductImage } from "@/components/ui/product-image";

type ProductGalleryProps = {
  photos: string[];
  alt: string;
  // Boutons superposés (favoris, zoom…) : rendus par l'appelant, positionnés
  // en absolute à l'intérieur du cadre image (relative + overflow-hidden).
  overlay?: React.ReactNode;
  onSlideChange?: (index: number) => void;
  thumbSizeClassName?: string;
};

// Galerie produit UNIQUE, utilisée par la fiche complète ET le panneau
// d'aperçu rapide : balayage + points sur téléphone, flèches + miniatures
// cliquables sur ordinateur. Un seul comportement à maintenir, plus de
// risque qu'un des deux écrans reste bloqué sur la 1re photo.
export function ProductGallery({
  photos,
  alt,
  overlay,
  onSlideChange,
  thumbSizeClassName = "w-16",
}: ProductGalleryProps) {
  const [slide, setSlide] = useState(0);
  const carrouselRef = useRef<HTMLDivElement>(null);

  const definirSlide = (index: number) => {
    setSlide(index);
    onSlideChange?.(index);
  };

  const majSlide = () => {
    const el = carrouselRef.current;
    if (el && el.clientWidth > 0) definirSlide(Math.round(el.scrollLeft / el.clientWidth));
  };

  const allerAuSlide = (index: number) => {
    const el = carrouselRef.current;
    if (!el || el.clientWidth === 0) return;
    el.scrollTo({ left: index * el.clientWidth, behavior: "smooth" });
  };

  if (photos.length <= 1) {
    return (
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-ink/5">
        <ProductImage src={photos[0] ?? null} alt={alt} className="h-full w-full" sizes="100vw" fit="contain" priority />
        {overlay}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-2xl">
        <div
          ref={carrouselRef}
          onScroll={majSlide}
          className="flex snap-x snap-mandatory overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {photos.map((src, index) => (
            <div key={src} className="relative aspect-square w-full shrink-0 snap-center bg-ink/5">
              <ProductImage
                src={src}
                alt={`${alt} — photo ${index + 1}`}
                className="h-full w-full"
                sizes="100vw"
                fit="contain"
                priority={index === 0}
              />
            </div>
          ))}
        </div>

        {/* Téléphone : points, pas de flèches (balayage au doigt). */}
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5 lg:hidden">
          {photos.map((src, index) => (
            <span
              key={src}
              className={`h-1.5 rounded-full transition-all ${
                index === slide ? "w-4 bg-brand" : "w-1.5 bg-white/70"
              }`}
            />
          ))}
        </div>

        {/* Ordinateur : flèches sur l'image (pas de balayage à la souris). */}
        <button
          type="button"
          onClick={() => allerAuSlide(Math.max(0, slide - 1))}
          disabled={slide === 0}
          aria-label="Photo précédente"
          className="absolute left-2 top-1/2 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-ink shadow disabled:opacity-0 lg:flex"
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => allerAuSlide(Math.min(photos.length - 1, slide + 1))}
          disabled={slide === photos.length - 1}
          aria-label="Photo suivante"
          className="absolute right-2 top-1/2 hidden size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-ink shadow disabled:opacity-0 lg:flex"
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>

        {overlay}
      </div>

      {/* Ordinateur : miniatures cliquables sous l'image. */}
      <div className="hidden gap-2 lg:flex">
        {photos.map((src, index) => (
          <button
            key={src}
            type="button"
            onClick={() => allerAuSlide(index)}
            aria-label={`Photo ${index + 1}`}
            className={`relative aspect-square ${thumbSizeClassName} shrink-0 overflow-hidden rounded-lg bg-ink/5 ring-2 transition-colors ${
              index === slide ? "ring-brand" : "ring-transparent"
            }`}
          >
            <ProductImage src={src} alt="" className="h-full w-full" sizes="64px" fit="contain" />
          </button>
        ))}
      </div>
    </div>
  );
}
