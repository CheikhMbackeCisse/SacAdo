"use client";

import { useCallback, useSyncExternalStore } from "react";

const KEY = "sacado_taille_texte";
const EVENT = "sacado:taille-texte";

export type TailleTexte = "normale" | "grande" | "tres_grande";

const CLASSES: Record<TailleTexte, string> = {
  normale: "",
  grande: "taille-grande",
  tres_grande: "taille-tres-grande",
};

let cache: TailleTexte | undefined;

function read(): TailleTexte {
  if (typeof window === "undefined") return "normale";
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw === "grande" || raw === "tres_grande" ? raw : "normale";
  } catch {
    return "normale";
  }
}

function apply(taille: TailleTexte) {
  const root = document.documentElement;
  root.classList.remove("taille-grande", "taille-tres-grande");
  const classe = CLASSES[taille];
  if (classe) root.classList.add(classe);
}

function getSnapshot(): TailleTexte {
  if (cache === undefined) cache = read();
  return cache;
}

function getServerSnapshot(): TailleTexte {
  return "normale";
}

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

// Même principe que lib/local/theme.ts : mémorisé sur l'appareil, appliqué
// avant le rendu par un script inline anti-flash (voir app/(storefront)/layout.tsx),
// synchronisé en base au meilleur effort quand le client est identifié
// (lib/moi/preferences-actions.ts::synchroniserAffichage).
export function useTailleTexte() {
  const taille = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setTaille = useCallback((next: TailleTexte) => {
    cache = next;
    try {
      if (next === "normale") window.localStorage.removeItem(KEY);
      else window.localStorage.setItem(KEY, next);
    } catch {
      // stockage indisponible : on applique quand même pour la session
    }
    apply(next);
    window.dispatchEvent(new CustomEvent(EVENT));
  }, []);

  return { taille, setTaille };
}
