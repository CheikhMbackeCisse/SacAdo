import { redirect } from "next/navigation";

// Ancienne route, remplacée par /confidentialite (TACHE_pages_legales_wave.md
// §4) — redirection pour ne pas casser un lien déjà partagé ou indexé.
export default function PolitiqueConfidentialiteRedirect() {
  redirect("/confidentialite");
}
