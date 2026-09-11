"use client";

import { useRemoteList } from "./use-remote-list";
import { getConsultesAction, enregistrerConsulteAction } from "@/lib/moi/consultes-actions";

const KEY = "consultes";
const MAX_CONSULTES = 20;

export type Consulte = { id: number; date: string };

// « Déjà consultés » en base (lot B6, TACHE_notifications_client.md) :
// nécessaires pour détecter une baisse de prix côté serveur. Même identité que
// les favoris, résolue côté serveur — API inchangée pour les appelants.
export function useConsultes() {
  const [consultes, setConsultes] = useRemoteList<Consulte>(KEY, getConsultesAction);

  const recordConsulte = (id: number) => {
    setConsultes((current) => {
      const sansId = current.filter((c) => c.id !== id);
      return [{ id, date: new Date().toISOString() }, ...sansId].slice(0, MAX_CONSULTES);
    });
    void enregistrerConsulteAction(id);
  };

  return { consultes, recordConsulte };
}
