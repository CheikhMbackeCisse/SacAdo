"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageOff } from "lucide-react";

type ProductImageProps = {
  src?: string | null;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
};

// next/image : compression + formats modernes (WebP/AVIF) + lazy loading
// automatiques. Le parent doit être position:relative (utilisé en `fill`).
// Les vraies photos ne sont pas encore fournies (voir CLAUDE.md section 7) :
// tant que le fichier n'existe pas sous /public/images, on bascule sur un
// placeholder plutôt que d'afficher une icône d'image cassée.
export function ProductImage({
  src,
  alt,
  className = "",
  sizes = "(min-width: 1024px) 25vw, 50vw",
  priority = false,
}: ProductImageProps) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex items-center justify-center bg-ink/5 text-ink/20 ${className}`}
        role="img"
        aria-label={alt}
      >
        <ImageOff size={28} aria-hidden="true" />
      </div>
    );
  }

  return (
    <>
      {/* Shimmer : pas de blurDataURL possible ici (photo dynamique venant de
          la base, pas d'import statique) — un fond animé le temps du
          chargement évite le "pop" brutal sans dépendre d'un pipeline
          d'image (sharp/plaiceholder) absent du projet. */}
      {!loaded && <div className="absolute inset-0 animate-pulse bg-ink/10" aria-hidden="true" />}
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        draggable={false}
        onDragStart={(event) => event.preventDefault()}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={`select-none object-cover transition-opacity duration-300 ${
          loaded ? "opacity-100" : "opacity-0"
        } ${className}`}
      />
    </>
  );
}
