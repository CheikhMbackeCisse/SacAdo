"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { slugAvecId } from "@/lib/slug";

// CORRECTIONS_V16 §2.1 : panneau d'aperçu produit sur ordinateur (>= 1024 px).
// Approche délibérément différente d'une route interceptée Next.js : une
// interception (.)produits/[slugId] s'appliquerait à TOUTE navigation client
// (Link), mobile compris, ce qui contredit "le mobile ne change pas" — il
// aurait fallu ensuite détecter la largeur d'écran pour désactiver
// l'interception, fragile. Ici c'est l'inverse : ProductCard décide au clic
// (desktop -> panneau + pushState, mobile -> navigation normale), donc le
// mobile garde exactement son comportement actuel. L'adresse change quand
// même (pushState) pour rester partageable/retour arrière ; un chargement
// direct de /produits/[slugId] sert toujours la fiche complète (page.tsx
// normal, aucune logique de panneau côté serveur).
type Etat = { produitId: number | null };

const HISTORY_MARKER = "sacadoApercu";

type ContexteApercu = {
  produitId: number | null;
  ouvrir: (id: number, nom: string) => void;
  fermer: () => void;
};

const Contexte = createContext<ContexteApercu | null>(null);

export function ProductPreviewProvider({ children }: { children: React.ReactNode }) {
  const [etat, setEtat] = useState<Etat>({ produitId: null });

  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      const state = event.state as { [HISTORY_MARKER]?: number } | null;
      setEtat({ produitId: state?.[HISTORY_MARKER] ?? null });
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const ouvrir = useCallback((id: number, nom: string) => {
    const url = `/produits/${slugAvecId(nom, id)}`;
    const dejaOuvert = window.history.state?.[HISTORY_MARKER] != null;
    if (dejaOuvert) {
      window.history.replaceState({ [HISTORY_MARKER]: id }, "", url);
    } else {
      window.history.pushState({ [HISTORY_MARKER]: id }, "", url);
    }
    setEtat({ produitId: id });
  }, []);

  const fermer = useCallback(() => {
    if (window.history.state?.[HISTORY_MARKER] != null) {
      window.history.back();
    } else {
      setEtat({ produitId: null });
    }
  }, []);

  // Échap ferme le panneau, où que soit le focus.
  useEffect(() => {
    if (etat.produitId === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") fermer();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [etat.produitId, fermer]);

  const valeur = useMemo(() => ({ produitId: etat.produitId, ouvrir, fermer }), [etat.produitId, ouvrir, fermer]);

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function useProductPreview(): ContexteApercu {
  const ctx = useContext(Contexte);
  if (!ctx) throw new Error("useProductPreview doit être utilisé dans ProductPreviewProvider");
  return ctx;
}
