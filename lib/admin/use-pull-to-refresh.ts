"use client";

import { useEffect, useRef, useState } from "react";

// Tirer vers le bas pour actualiser (PROMPT_ADMIN.md Lot 3), sur mobile
// uniquement : le geste ne démarre que si la page est déjà tout en haut
// (sinon on empiéterait sur un scroll normal). Seuil ~70px avant déclenchement.
const SEUIL = 70;

export function usePullToRefresh(onRefresh: () => void) {
  const [tirage, setTirage] = useState(0);
  const [actualisation, setActualisation] = useState(false);
  const depart = useRef<number | null>(null);

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0) depart.current = e.touches[0].clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (depart.current === null) return;
      const delta = e.touches[0].clientY - depart.current;
      if (delta > 0 && window.scrollY === 0) setTirage(Math.min(delta, SEUIL * 1.5));
    };
    const onTouchEnd = () => {
      if (tirage >= SEUIL) {
        setActualisation(true);
        onRefresh();
        setTimeout(() => setActualisation(false), 1000);
      }
      setTirage(0);
      depart.current = null;
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tirage]);

  return { tirage, actualisation, seuil: SEUIL };
}
