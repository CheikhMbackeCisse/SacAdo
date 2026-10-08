"use client";

import type { ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Glisser-déposer réel (PROMPT_EXPORTS_ET_CORRECTIONS.md Lot 3) : remplace
// l'ancien `useGlisserDeposer` (HTML5 drag natif + pointer events maison, peu
// fiable notamment au doigt) par @dnd-kit — aperçu live de la tuile déplacée,
// animation des voisines, même comportement souris (ordinateur) et doigt
// (téléphone, appui long). Les boutons précédent/suivant restent le repli
// clavier/souris existant dans chaque appelant, inchangés.
//
// `distance`/`delay` : une tuile contient des boutons cliquables (retirer,
// quantité…) — sans seuil d'activation, le moindre pointerdown déclencherait
// un drag et avalerait le clic. Un vrai geste de glisser dépasse ces seuils,
// un tap/clic simple non.
const SEUILS_ACTIVATION = {
  souris: { distance: 8 },
  tactile: { delay: 200, tolerance: 8 },
};

export type EtatTuile = { enTrainDeGlisser: boolean };

export function ListeReordonnable<T>({
  items,
  idDe,
  onReorder,
  renderItem,
  className,
  disposition = "grille",
}: {
  items: T[];
  idDe: (item: T) => string | number;
  onReorder: (nouveaux: T[]) => void;
  renderItem: (item: T, etat: EtatTuile) => ReactNode;
  className?: string;
  // "grille" (mosaïque 2D : items/photos) ou "liste" (colonne verticale : À découvrir).
  disposition?: "grille" | "liste";
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: SEUILS_ACTIVATION.souris }),
    useSensor(TouchSensor, { activationConstraint: SEUILS_ACTIVATION.tactile }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = items.map(idDe);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const depart = ids.indexOf(active.id as string | number);
    const arrivee = ids.indexOf(over.id as string | number);
    if (depart === -1 || arrivee === -1) return;
    onReorder(arrayMove(items, depart, arrivee));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={disposition === "grille" ? rectSortingStrategy : verticalListSortingStrategy}>
        <div className={className}>
          {items.map((item) => (
            <Tuile key={idDe(item)} id={idDe(item)}>
              {(etat) => renderItem(item, etat)}
            </Tuile>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function Tuile({
  id,
  children,
}: {
  id: string | number;
  children: (etat: EtatTuile) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : undefined,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="touch-none">
      {children({ enTrainDeGlisser: isDragging })}
    </div>
  );
}
