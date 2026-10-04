import { type NextRequest } from "next/server";
import { journaliserVisite, type TypeVisite } from "@/lib/trafic/mesure";
import { getClientIp, verifierLimite } from "@/lib/security/rate-limit";
import { userAgentEstRobot } from "@/lib/pwa/bot-detection";

export const dynamic = "force-dynamic";

// Collecte des signaux de fréquentation (navigator.sendBeacon dans
// lib/trafic/mesure-client.ts) : page vue, produit vu, ajout/retrait panier,
// début commande, recherche, page 404. "Commande validée" est journalisée
// directement côté serveur (lib/checkout/actions.ts), jamais par ce point
// d'entrée. Same-origin uniquement (CSP connect-src 'self').

const TYPES_CLIENT: ReadonlySet<TypeVisite> = new Set([
  "page_vue",
  "produit_vu",
  "ajout_panier",
  "retrait_panier",
  "debut_commande",
  "recherche",
  "page_404",
]);

function texte(v: unknown, max: number): string | undefined {
  return typeof v === "string" && v.trim() ? v.slice(0, max) : undefined;
}

function entierPositif(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : undefined;
}

export async function POST(request: NextRequest) {
  // Jamais pour les robots (même liste que la fenêtre d'installation PWA).
  const userAgent = request.headers.get("user-agent") ?? "";
  if (userAgentEstRobot(userAgent)) {
    return Response.json({ ok: true });
  }

  let corps: unknown;
  try {
    corps = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  const p = (corps ?? {}) as Record<string, unknown>;
  const type = typeof p.type === "string" ? (p.type as TypeVisite) : null;
  if (!type || !TYPES_CLIENT.has(type)) {
    return Response.json({ ok: false }, { status: 400 });
  }

  // Anti-flood : ~120 signaux / minute / IP, comme /api/mesure.
  const ip = await getClientIp();
  if (!(await verifierLimite(`trafic:${ip}`, 120, 60))) {
    return Response.json({ ok: false }, { status: 429 });
  }

  await journaliserVisite({
    type,
    page: texte(p.page, 300),
    produitId: entierPositif(p.produitId),
    quantite: typeof p.quantite === "number" ? Math.trunc(p.quantite) : undefined,
    prixUnitaire: entierPositif(p.prixUnitaire),
    recherche: texte(p.recherche, 120),
    rechercheSansResultat: typeof p.rechercheSansResultat === "boolean" ? p.rechercheSansResultat : undefined,
    utmSource: texte(p.utmSource, 100),
    utmMedium: texte(p.utmMedium, 100),
    utmCampaign: texte(p.utmCampaign, 100),
    gclid: texte(p.gclid, 200),
    appInstallee: typeof p.appInstallee === "boolean" ? p.appInstallee : undefined,
  });

  return Response.json({ ok: true });
}
