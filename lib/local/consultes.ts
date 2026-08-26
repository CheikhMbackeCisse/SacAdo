"use client";

import { useLocalList } from "./use-local-list";

const KEY = "sacado_consultes";
const MAX_CONSULTES = 20;

export type Consulte = { id: number; date: string };

export function useConsultes() {
  const [consultes, setConsultes] = useLocalList<Consulte>(KEY);

  const recordConsulte = (id: number) => {
    setConsultes((current) => {
      const sansId = current.filter((c) => c.id !== id);
      return [{ id, date: new Date().toISOString() }, ...sansId].slice(0, MAX_CONSULTES);
    });
  };

  return { consultes, recordConsulte };
}
