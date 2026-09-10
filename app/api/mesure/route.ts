import { type NextRequest } from "next/server";
import { journaliserEvenement, type EvenementType } from "@/lib/mesure";
import { getClientIp, verifierLimite } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

// Collecte des signaux de navigation déclenchés côté client (navigator.sendBeacon
// dans lib/mesure-client.ts) : vue produit, vue catégorie, recherche, ajout
// panier. La `recherche` et la `commande` déclenchées côté serveur passent
// directement par lib/mesure.ts. Same-origin uniquement (CSP connect-src 'self').

const TYPES_CLIENT: ReadonlySet<EvenementType> = new Set([
  "vue_produit",
  "vue_categorie",
  "recherche",
  "ajout_panier",
]);

function entierPositif(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : undefined;
}

export async function POST(request: NextRequest) {
  let corps: unknown;
  try {
    corps = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  const p = (corps ?? {}) as Record<string, unknown>;
  const type = typeof p.type === "string" ? (p.type as EvenementType) : null;
  if (!type || !TYPES_CLIENT.has(type)) {
    return Response.json({ ok: false }, { status: 400 });
  }

  // Anti-flood : ~120 signaux / minute / IP. Large pour un usage réel, borne
  // un script qui martèle l'endpoint.
  const ip = await getClientIp();
  if (!(await verifierLimite(`mesure:${ip}`, 120, 60))) {
    return Response.json({ ok: false }, { status: 429 });
  }

  await journaliserEvenement({
    type,
    produitId: entierPositif(p.produitId),
    categorieId: entierPositif(p.categorieId),
    sousCategorieId: entierPositif(p.sousCategorieId),
    recherche: typeof p.recherche === "string" ? p.recherche : undefined,
  });

  return Response.json({ ok: true });
}
