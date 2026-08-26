"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const DUREE_MS = 900;

// Habillage du tout début de chargement, PAS un préchargement du catalogue :
// disparaît tout seul après une durée courte et fixe, avant même que les
// données du catalogue n'aient besoin d'être prêtes.
export function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const [sortie, setSortie] = useState(false);

  useEffect(() => {
    const debutSortie = setTimeout(() => setSortie(true), DUREE_MS);
    const retraitDom = setTimeout(() => setVisible(false), DUREE_MS + 300);
    return () => {
      clearTimeout(debutSortie);
      clearTimeout(retraitDom);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-surface transition-opacity duration-300 ${
        sortie ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      aria-hidden="true"
    >
      <div className="relative size-28 animate-pulse">
        <Image src="/images/hero-marque.jpg" alt="" fill sizes="112px" className="rounded-2xl object-cover" />
      </div>
      <p className="max-w-[220px] text-center text-sm text-ink/60">
        Kits scolaires et fournitures d&apos;étude, livrés partout au Sénégal.
      </p>
      <div className="h-1 w-24 overflow-hidden rounded-full bg-ink/10">
        <div className="h-full w-1/3 animate-[splash-bar_900ms_ease-in-out_infinite] rounded-full bg-brand" />
      </div>
    </div>
  );
}
