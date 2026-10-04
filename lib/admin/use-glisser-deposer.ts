"use client";

import { useRef, useState } from "react";

// Glisser-déposer générique pour une mosaïque réordonnable (PROMPT_ADMIN_KITS_PRODUITS.md
// lot 2) : souris/trackpad via le drag-and-drop natif HTML5, tactile via un
// appui long (350 ms) puis déplacement du doigt (élément sous le doigt lu par
// elementFromPoint, puisque le pointeur tactile ne déclenche pas dragover).
// `items` reste la source de vérité : on ne réordonne jamais localement sans
// prévenir l'appelant (`onReorder` reçoit le tableau déjà réordonné).
export function useGlisserDeposer<T>(items: T[], idDe: (item: T) => number, onReorder: (nouveaux: T[]) => void) {
  const [idDeplace, setIdDeplace] = useState<number | null>(null);
  const [idSurvole, setIdSurvole] = useState<number | null>(null);
  const minuteurAppuiLong = useRef<ReturnType<typeof setTimeout> | null>(null);
  const departPointeur = useRef<{ x: number; y: number } | null>(null);
  const [arme, setArme] = useState(false);

  const annulerMinuteur = () => {
    if (minuteurAppuiLong.current) clearTimeout(minuteurAppuiLong.current);
    minuteurAppuiLong.current = null;
  };

  const reordonnerVers = (depuisId: number, versId: number) => {
    if (depuisId === versId) return;
    const indexDepart = items.findIndex((it) => idDe(it) === depuisId);
    const indexArrivee = items.findIndex((it) => idDe(it) === versId);
    if (indexDepart === -1 || indexArrivee === -1) return;
    const copie = [...items];
    const [deplace] = copie.splice(indexDepart, 1);
    copie.splice(indexArrivee, 0, deplace);
    onReorder(copie);
  };

  const reinitialiser = () => {
    annulerMinuteur();
    departPointeur.current = null;
    setArme(false);
    setIdDeplace(null);
    setIdSurvole(null);
  };

  const proprietesTuile = (id: number) => ({
    "data-glisser-id": id,
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      setIdDeplace(id);
      e.dataTransfer.effectAllowed = "move";
    },
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setIdSurvole(id);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      if (idDeplace != null) reordonnerVers(idDeplace, id);
      reinitialiser();
    },
    onDragEnd: reinitialiser,
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType !== "touch") return;
      departPointeur.current = { x: e.clientX, y: e.clientY };
      minuteurAppuiLong.current = setTimeout(() => {
        setIdDeplace(id);
        setArme(true);
      }, 350);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (e.pointerType !== "touch") return;
      if (!arme) {
        if (minuteurAppuiLong.current && departPointeur.current) {
          const dx = Math.abs(e.clientX - departPointeur.current.x);
          const dy = Math.abs(e.clientY - departPointeur.current.y);
          if (dx > 10 || dy > 10) annulerMinuteur();
        }
        return;
      }
      e.preventDefault();
      const element = document.elementFromPoint(e.clientX, e.clientY);
      const tuile = element?.closest("[data-glisser-id]");
      const idBrut = tuile?.getAttribute("data-glisser-id");
      if (idBrut != null) setIdSurvole(Number(idBrut));
    },
    onPointerUp: () => {
      if (arme && idDeplace != null && idSurvole != null) reordonnerVers(idDeplace, idSurvole);
      reinitialiser();
    },
    onPointerCancel: reinitialiser,
  });

  return { idDeplace, idSurvole, proprietesTuile };
}
