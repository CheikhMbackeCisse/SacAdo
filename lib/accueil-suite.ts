"use server";

// Chargement continu de l'accueil (maj-accueil §6) : le client rappelle cette
// action avec une limite plus grande à chaque descente en bas de page. Grâce
// à la graine de session (voir lib/accueil.ts), le début du flux déjà affiché
// ne bouge pas — seule la queue s'allonge.
import { getAccueilFeed, type AccueilFeed } from "@/lib/accueil";

export async function chargerPageAccueil(limit: number, dejaAffichees: number): Promise<AccueilFeed> {
  return getAccueilFeed(limit, dejaAffichees);
}
