"use client";

import { useEffect, useRef } from "react";

// Retour arrière depuis une fiche produit (CORRECTIONS_V11 lot 2) : par
// défaut, une liste en chargement continu perd tout ce qui avait été chargé
// au-delà de la première page (remontage du composant) et le navigateur ne
// retombe pas forcément sur la bonne position de défilement. On sauvegarde en
// continu (défilement) le nombre d'articles déjà affichés + la position, et
// on les restaure une fois au montage si une sauvegarde existe pour cette
// même vue (`cle` doit identifier la route ET les filtres actifs : une vue
// différente ne doit jamais restaurer une position qui ne lui appartient pas).
export function useRestaurerDefilement(
  cle: string,
  compteActuel: number,
  chargerJusqua: (compte: number) => Promise<void>,
  // Certaines listes n'ont leurs données prêtes qu'après un chargement
  // initial asynchrone (ex. favoris) : tant que ce n'est pas prêt, on
  // n'essaie pas de restaurer (la mise en page n'a pas encore sa hauteur
  // finale, le scrollTo tomberait au mauvais endroit).
  pret: boolean = true,
) {
  const restaure = useRef(false);
  const compteRef = useRef(compteActuel);
  useEffect(() => {
    compteRef.current = compteActuel;
  });

  useEffect(() => {
    const sauver = () => {
      sessionStorage.setItem(cle, JSON.stringify({ compte: compteRef.current, scrollY: window.scrollY }));
    };
    window.addEventListener("scroll", sauver, { passive: true });
    return () => window.removeEventListener("scroll", sauver);
  }, [cle]);

  useEffect(() => {
    if (restaure.current || !pret) return;
    restaure.current = true;
    const brut = sessionStorage.getItem(cle);
    if (!brut) return;
    try {
      const { compte, scrollY } = JSON.parse(brut) as { compte: number; scrollY: number };
      // Attendre que la page soit assez haute avant de défiler : juste après
      // que les données arrivent, React n'a pas forcément fini de peindre le
      // nouveau contenu (images en cours de décodage, etc.) — un scrollTo trop
      // tôt tombe sur une page encore courte et atterrit dans le vide.
      const aller = () => {
        let tentatives = 0;
        const essayer = () => {
          const assezHaut = document.documentElement.scrollHeight - window.innerHeight >= scrollY;
          if (assezHaut || tentatives >= 30) {
            window.scrollTo(0, scrollY);
            return;
          }
          tentatives++;
          requestAnimationFrame(essayer);
        };
        requestAnimationFrame(essayer);
      };
      if (compte > compteRef.current) {
        void chargerJusqua(compte).then(aller);
      } else {
        aller();
      }
    } catch {
      // Sauvegarde illisible : on ignore, la page reste en haut (comportement normal).
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle, pret]);
}
