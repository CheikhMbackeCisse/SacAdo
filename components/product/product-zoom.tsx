"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { matchProductPhotoVariant } from "@/lib/images/supabase-image-loader";

type ProductZoomProps = {
  photos: string[];
  index: number;
  alt: string;
  onClose: () => void;
};

// Vue plein écran d'une photo produit, en <img> classique (pas next/image) :
// on tente la variante -1200 (qui n'existe pas toujours, voir
// supabase-image-loader.ts) et on retombe sur la photo déjà affichée dans la
// galerie — donc déjà chargée avec succès juste avant — si elle échoue.
// Aucun scénario ne peut afficher une image cassée.
export function ProductZoom({ photos, index, alt, onClose }: ProductZoomProps) {
  const [current, setCurrent] = useState(index);
  const src = photos[current] ?? null;
  // Le -1200 en échec pour CE src est mémorisé par sa propre URL : dès que
  // `current` change, la cible recalculée ci-dessous change aussi, donc la
  // comparaison repasse naturellement à false sans effet ni réinitialisation
  // manuelle.
  const [cibleEnEchec, setCibleEnEchec] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (!src) return null;

  const cible = variante1200(src);
  const affiche = cible === cibleEnEchec ? src : cible;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/95"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer"
        className="absolute right-4 top-4 z-10 flex size-10 items-center justify-center rounded-full bg-white/10 text-white"
      >
        <X size={22} aria-hidden="true" />
      </button>

      <div
        className="flex flex-1 items-center justify-center overflow-hidden p-4"
        onClick={(event) => event.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- repli onError impossible avec next/image, voir commentaire ci-dessus */}
        <img
          src={affiche}
          alt={alt}
          draggable={false}
          onError={() => {
            // La -1200 demandée n'existe pas : repli sur la variante déjà
            // affichée dans la galerie, garantie de fonctionner puisqu'elle
            // vient de charger avec succès juste avant l'ouverture du zoom.
            if (affiche !== src) setCibleEnEchec(cible);
          }}
          className="max-h-full max-w-full select-none object-contain"
        />
      </div>

      {photos.length > 1 && (
        <div
          className="flex justify-center gap-2 pb-6"
          onClick={(event) => event.stopPropagation()}
        >
          {photos.map((photo, i) => (
            <button
              key={photo}
              type="button"
              aria-label={`Photo ${i + 1}`}
              onClick={() => setCurrent(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === current ? "w-4 bg-white" : "w-1.5 bg-white/40"
              }`}
            />
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
}

function variante1200(src: string): string;
function variante1200(src: null): null;
function variante1200(src: string | null): string | null {
  if (!src) return null;
  const parsed = matchProductPhotoVariant(src);
  return parsed ? `${parsed.base}-1200${parsed.ext}` : src;
}
