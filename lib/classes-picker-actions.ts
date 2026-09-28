"use server";

import { getClassesActives } from "./supabase/queries";
import type { ClasseDb } from "./supabase/types";

// Wrapper "use server" pour les composants client qui ont besoin de la liste
// des classes (ex: SacadosSection) — lib/supabase/queries.ts n'est pas un
// module "use server" (trop de fonctions, pas toutes destinées au client).
export async function getClassesPourPicker(): Promise<ClasseDb[]> {
  return getClassesActives();
}
