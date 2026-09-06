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
