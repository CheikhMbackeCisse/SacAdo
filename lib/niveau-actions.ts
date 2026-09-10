"use server";

import { cookies } from "next/headers";
import { COOKIE_NIVEAU, encoderNiveau } from "@/lib/niveau";

// Enregistre le niveau qu'un visiteur consulte au sélecteur de kit, dans un
// cookie propriétaire. Sert au démarrage à froid de la personnalisation
// (TACHE_identite §1 démarrage : « le niveau déclaré est le signal le plus fort
// de toute l'app et il est gratuit »). httpOnly : lu seulement côté serveur.
const MAX_AGE = 60 * 60 * 24 * 365; // 12 mois

export async function declarerNiveau(cycle: string, classe: string): Promise<void> {
  const c = String(cycle ?? "").trim().slice(0, 20);
  const n = String(classe ?? "").trim().slice(0, 40);
  if (!c || !n) return;
  const jar = await cookies();
  jar.set(COOKIE_NIVEAU, encoderNiveau(c, n), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: MAX_AGE,
    path: "/",
  });
}
