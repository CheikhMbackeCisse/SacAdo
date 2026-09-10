"use client";

import { useEffect } from "react";
import { declarerNiveau } from "@/lib/niveau-actions";

// Monté sur les écrans du sélecteur de kit : mémorise le niveau consulté pour
// personnaliser l'accueil dès la première visite (TACHE_identite §1 démarrage).
export function DeclarerNiveau({ cycle, niveau }: { cycle: string; niveau: string }) {
  useEffect(() => {
    void declarerNiveau(cycle, niveau);
  }, [cycle, niveau]);
  return null;
}
