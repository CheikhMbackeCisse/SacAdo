"use client";

import { useState } from "react";
import Image from "next/image";

type CategoryImageProps = {
  src: string;
  alt: string;
};

// Séparé de CategoryTile (qui reste un composant serveur) car l'état de
// chargement (shimmer) nécessite un Client Component — et un Client
// Component ne peut recevoir que des props sérialisables, pas l'icône
// Lucide (fonction) portée par Categorie.
export function CategoryImage({ src, alt }: CategoryImageProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <>
      {!loaded && <span className="absolute inset-0 animate-pulse bg-ink/10" aria-hidden="true" />}
      <Image
        src={src}
        alt={alt}
        fill
        sizes="120px"
        draggable={false}
        onDragStart={(event) => event.preventDefault()}
        onLoad={() => setLoaded(true)}
        className={`select-none object-cover transition-opacity duration-300 ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
      />
    </>
  );
}
