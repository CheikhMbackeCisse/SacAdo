"use client";

import { useEffect, useRef } from "react";

// Fin de liste (maj-26-09 §8) : "les produits suivants se chargent tout
// seuls", plus de bouton "Charger plus". Observe une sentinelle en bas de
// liste et déclenche `onIntersect` dès qu'elle entre dans le viewport.
export function useChargementAuto(actif: boolean, onIntersect: () => void) {
  const sentinelleRef = useRef<HTMLDivElement>(null);
  // Toujours la dernière closure (produits/chargement à jour) sans reposer
  // l'observateur à chaque rendu. Affecté dans un effet (pas pendant le
  // rendu) : une ref ne doit être écrite qu'après coup.
  const onIntersectRef = useRef(onIntersect);
  useEffect(() => {
    onIntersectRef.current = onIntersect;
  });

  useEffect(() => {
    if (!actif) return;
    const cible = sentinelleRef.current;
    if (!cible) return;

    const observateur = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onIntersectRef.current();
      },
      { rootMargin: "400px" },
    );
    observateur.observe(cible);
    return () => observateur.disconnect();
  }, [actif]);

  return sentinelleRef;
}
