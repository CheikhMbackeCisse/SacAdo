import { requireAdmin } from "@/lib/admin/guard";
import { analyserImportKits, appliquerImportKits } from "@/lib/admin/kits-import-actions";

// Import Excel du contenu des kits (PROMPT_ADMIN.md Lot 5). Deux modes :
// "apercu" (lecture seule, calcule le diff) et "appliquer" (écrit), jamais
// les deux en un seul appel — l'admin doit valider l'aperçu avant d'écrire.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return Response.json({ error: "Non autorisé." }, { status: 401 });
  }

  const form = await request.formData();
  const fichier = form.get("fichier");
  const mode = form.get("mode");
  if (!(fichier instanceof File) || (mode !== "apercu" && mode !== "appliquer")) {
    return Response.json({ error: "Requête invalide." }, { status: 400 });
  }

  const buffer = Buffer.from(await fichier.arrayBuffer());

  if (mode === "apercu") {
    const apercu = await analyserImportKits(buffer);
    return Response.json(apercu);
  }

  const resultat = await appliquerImportKits(buffer);
  return Response.json(resultat);
}
