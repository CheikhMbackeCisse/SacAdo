import "server-only";
import { headers } from "next/headers";

// Origine publique du site (https://sacado...), pour construire des liens
// absolus côté serveur : lien du bon de préparation, URLs de retour Wave, etc.
export async function origineSite(): Promise<string> {
  const configuree = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (configuree) return configuree;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}` : "http://localhost:3000";
}

// La plupart des photos produit sont des URL Supabase Storage déjà absolues,
// mais certaines (placeholders de catégorie sous /public, ex. kits sans vraie
// photo) sont stockées en chemin relatif ("/images/cat-kits.png"). Nécessaire
// partout où l'URL doit être exploitable hors du navigateur (JSON-LD, image
// Open Graph) — next/image, lui, résout déjà un chemin relatif tout seul.
export function urlAbsolue(site: string, chemin: string): string {
  return /^https?:\/\//.test(chemin) ? chemin : `${site}${chemin}`;
}
