// Manifeste de l'app d'ADMINISTRATION. `id` est le champ décisif : sans lui
// (ou avec un `id`/`scope` partagé), Chrome considère que c'est la même app
// que l'espace client et refuse la seconde installation.
//
// Host-aware (TACHE_admin_sous_domaine.md, Phase 3) : ce fichier reste
// accessible à la même URL `/admin/manifest.webmanifest` dans les deux cas,
// mais son contenu change selon l'origine qui le demande —
//   - sur admin.sacado.sn : l'admin EST la racine de son origine ->
//     start_url/scope/id relatifs à "/".
//   - partout ailleurs (Preview Vercel, localhost) : l'admin reste servi en
//     place sous /admin/* sur la même origine que la boutique -> inchangé.
import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_URL } from "@/lib/site";

const ADMIN_HOST = new URL(ADMIN_URL).hostname;

function hostDeRequete(request: NextRequest): string {
  const brut = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  return brut.split(":")[0].toLowerCase();
}

// Dépend de l'en-tête Host : ne peut pas être pré-généré statiquement.
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const surSousDomaine = hostDeRequete(request) === ADMIN_HOST;
  const racine = surSousDomaine ? "/" : "/admin";

  const manifeste = {
    id: racine,
    name: "SacAdo Admin",
    short_name: "Admin",
    description: "Gestion SacAdo : commandes, stocks, préparations, reporting.",
    start_url: racine,
    scope: surSousDomaine ? "/" : "/admin/",
    display: "standalone",
    orientation: "portrait",
    lang: "fr",
    background_color: "#031726",
    theme_color: "#031726",
    icons: [
      { src: "/icons/admin-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/admin-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/admin-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };

  return NextResponse.json(manifeste, {
    headers: {
      "Content-Type": "application/manifest+json",
      // Le manifeste change rarement pour une origine donnée ; cache court
      // côté navigateur seulement (la variation se fait côté serveur).
      "Cache-Control": "private, max-age=3600",
    },
  });
}
