"use client";

import { useCallback, useSyncExternalStore } from "react";

const KEY = "sacado_theme";
const EVENT = "sacado:theme";

// "systeme" = pas d'attribut data-theme, on laisse la media query
// prefers-color-scheme décider (voir app/globals.css).
export type Theme = "clair" | "sombre" | "systeme";

let cache: Theme | undefined;

function read(): Theme {
  if (typeof window === "undefined") return "systeme";
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw === "clair" || raw === "sombre" ? raw : "systeme";
  } catch {
    return "systeme";
  }
}

function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === "clair") root.setAttribute("data-theme", "light");
  else if (theme === "sombre") root.setAttribute("data-theme", "dark");
  else root.removeAttribute("data-theme");
}

function getSnapshot(): Theme {
  if (cache === undefined) cache = read();
  return cache;
}

function getServerSnapshot(): Theme {
  return "systeme";
}

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

// Le choix est mémorisé sur l'appareil et appliqué avant le rendu par un petit
// script inline dans le layout (anti-flash). Ce hook sert au contrôle de bascule
// dans les Paramètres.
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setTheme = useCallback((next: Theme) => {
    cache = next;
    try {
      if (next === "systeme") window.localStorage.removeItem(KEY);
      else window.localStorage.setItem(KEY, next);
    } catch {
      // stockage indisponible : on applique quand même pour la session
    }
    apply(next);
    window.dispatchEvent(new CustomEvent(EVENT));
  }, []);

  return { theme, setTheme };
}
