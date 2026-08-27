"use client";

import { useEffect, useRef, useState } from "react";

// Seuil de déplacement avant de basculer l'état : évite que la nav clignote sur
// les micro-scrolls (élastique iOS, molette imprécise).
const THRESHOLD = 8;
// En dessous de cette position, on considère qu'on est "en haut" et la nav
// reste toujours visible (on n'a pas encore commencé à parcourir la liste).
const TOP_ZONE = 24;

// true = la nav doit être visible, false = cachée.
// Règle (voir CORRECTIONS_V3) : scroll vers le bas -> on cache la nav pour
// laisser voir plus d'articles ; scroll vers le haut -> on la réaffiche pour
// pouvoir naviguer sans remonter toute la page.
export function useNavVisible(): boolean {
  const [visible, setVisible] = useState(true);
  const lastY = useRef(0);

  useEffect(() => {
    lastY.current = window.scrollY;

    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY.current;

      if (y <= TOP_ZONE) {
        setVisible(true);
        lastY.current = y;
        return;
      }

      if (Math.abs(delta) < THRESHOLD) return;

      setVisible(delta < 0);
      lastY.current = y;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return visible;
}
