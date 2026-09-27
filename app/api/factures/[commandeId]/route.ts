import { type NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { verifierJetonClient } from "@/lib/client-auth";
import { requireAdmin } from "@/lib/admin/guard";
import { chargerDonneesFacture } from "@/lib/factures/data";
import { FactureDocument } from "@/lib/factures/document";
import { numeroFacture } from "@/lib/factures/config";

// SacAdo — Facture PDF (MODULE_FACTURES.md §2-§3, §5, "Sécurité"). Générée à la
// volée à partir des données live (jamais stockée) : toujours à jour, rien à
// nettoyer si une commande change. @react-pdf/renderer utilise des API Node
// (fontkit) -> route forcée sur le runtime Node, pas l'edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Accès :
//  - le client, via ?t=<jeton> (même jeton que /suivi/[id], lib/client-auth.ts) ;
//  - l'admin connecté (lib/admin/guard.ts), sans jeton, depuis le back-office.
// Ni l'un ni l'autre -> 404 (jamais de facture accessible en devinant un
// numéro de commande, "Sécurité" du document source).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ commandeId: string }> },
) {
  const { commandeId: commandeIdParam } = await params;
  const commandeId = Number(commandeIdParam);
  if (!Number.isFinite(commandeId)) {
    return Response.json({ error: "introuvable" }, { status: 404 });
  }

  const donnees = await chargerDonneesFacture(commandeId);
  if (!donnees) {
    return Response.json({ error: "introuvable" }, { status: 404 });
  }

  const jeton = request.nextUrl.searchParams.get("t");
  const autoriseClient = verifierJetonClient(donnees.commande.client_id, jeton);

  let autoriseAdmin = false;
  if (!autoriseClient) {
    try {
      await requireAdmin();
      autoriseAdmin = true;
    } catch {
      autoriseAdmin = false;
    }
  }

  if (!autoriseClient && !autoriseAdmin) {
    return Response.json({ error: "introuvable" }, { status: 404 });
  }

  const pdf = await renderToBuffer(FactureDocument({ donnees }));

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="facture-${numeroFacture(donnees.factureId)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
