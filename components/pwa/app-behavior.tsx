"use client";

import { useEffect } from "react";

// Zones où l'on laisse le comportement natif (sélection, menu contextuel,
// glisser) : la même liste que le bloc d'exceptions de styles/app-feel.css.
const ZONES_LIBRES =
  'input, textarea, select, [contenteditable="true"], .selectionnable';

// Le CSS ne suffit pas sur Android : `-webkit-touch-callout` y est ignoré, et le
// long appui ouvre quand même le menu Chrome (« Copier l'adresse du lien… ») ou
// sélectionne le texte. On bloque les événements correspondants hors zones de
// saisie. Voir TACHE_app_feel_et_recherche.md §1.2.
export function AppBehavior() {
  useEffect(() => {
    const dansZoneLibre = (cible: EventTarget | null) =>
      cible instanceof Element && cible.closest(ZONES_LIBRES);

    const surMenuContextuel = (e: Event) => {
      if (!dansZoneLibre(e.target)) e.preventDefault();
    };
    const surSelection = (e: Event) => {
      if (!dansZoneLibre(e.target)) e.preventDefault();
    };
    const surGlisser = (e: Event) => {
      if (e.target instanceof Element && e.target.closest("img, a")) {
        e.preventDefault();
      }
    };

    document.addEventListener("contextmenu", surMenuContextuel);
    document.addEventListener("selectstart", surSelection);
    document.addEventListener("dragstart", surGlisser);
    return () => {
      document.removeEventListener("contextmenu", surMenuContextuel);
      document.removeEventListener("selectstart", surSelection);
      document.removeEventListener("dragstart", surGlisser);
    };
  }, []);

  return null;
}
