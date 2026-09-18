import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { getProduitById } from "@/lib/supabase/queries";
import { origineSite, urlAbsolue } from "@/lib/site-url";
import { idDepuisSlug } from "@/lib/slug";
import { formatPrice } from "@/lib/format";

// Route dédiée (plutôt que la convention spéciale opengraph-image.tsx) : cette
// dernière ne sait produire que du PNG, et une vraie photo de produit encodée
// en PNG (sans perte) dépasse largement les 300 Ko tolérés par WhatsApp pour
// afficher un aperçu (testé : ~850 Ko). On repasse par `sharp` (déjà une
// dépendance du projet, utilisée par l'optimiseur next/image en prod) pour
// ressortir un JPEG compressé sous ce seuil.
export const revalidate = 3600;

const BLEU_MARQUE = "#0B3D91";
const LARGEUR = 1200;
const HAUTEUR = 630;

// Sans `fonts` explicite, satori (moteur de next/og) tente de son propre chef
// d'aller chercher une police de secours sur fonts.googleapis.com pour tout
// glyphe absent de sa police par défaut embarquée (10s de timeout, et
// indisponible en prod si le réseau sortant est bloqué) — exactement le
// chargement distant que la consigne interdit. On lui fournit nous-mêmes la
// police par défaut de Next (déjà sur disque, aucun réseau), ce qui désactive
// complètement ce filet de secours.
const CHEMIN_POLICE = path.join(
  process.cwd(),
  "node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf",
);
let policePromise: Promise<Buffer> | null = null;
function chargerPolice(): Promise<Buffer> {
  policePromise ??= readFile(CHEMIN_POLICE);
  return policePromise;
}

// satori (moteur de next/og) ne sait décoder que PNG/JPEG en <img> — pas le
// WebP dans lequel beaucoup de photos produit sont stockées (échoue en
// silence ou en erreur selon le cas). On fait le fetch + la conversion
// nous-mêmes via sharp et on passe l'image déjà décodée en data URI :
// aucune contrainte de format côté satori, et un seul appel réseau qu'on
// contrôle (repli propre sur "pas de photo" si ça échoue).
async function photoEnDataUri(url: string): Promise<string | null> {
  try {
    const reponse = await fetch(url);
    if (!reponse.ok) return null;
    const brut = Buffer.from(await reponse.arrayBuffer());
    const jpeg = await sharp(brut).resize(540, 630, { fit: "cover" }).jpeg({ quality: 80 }).toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function GET(_request: Request, props: { params: Promise<{ slugId: string }> }) {
  const { slugId } = await props.params;
  const id = idDepuisSlug(slugId);
  const produit = id !== null ? await getProduitById(id) : null;
  const site = await origineSite();
  const logo = `${site}/images/logo.jpg`;
  // Toujours la photo pleine résolution de la fiche, jamais une vignette de
  // liste. Certains produits (placeholders de kit) stockent un chemin
  // relatif /public plutôt qu'une URL Supabase Storage absolue.
  const photoBrute = produit ? produit.photos[0] ?? produit.photo : null;
  const [photo, police] = await Promise.all([
    photoBrute ? photoEnDataUri(urlAbsolue(site, photoBrute)) : Promise.resolve(null),
    chargerPolice(),
  ]);
  // toLocaleString("fr-FR") sépare les milliers par une espace fine
  // insécable (U+202F) : glyphe absent de certaines polices, on la remplace
  // par une espace normale pour cet aperçu (aucun impact sur l'affichage
  // dans l'app, qui utilise formatPrice ailleurs sans repasser par ici).
  const prixAffiche = produit ? formatPrice(produit.prix).replace(/[  ]/g, " ") : "";

  const image = new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#FEFDFF" }}>
        <div
          style={{
            width: photo ? "45%" : "0%",
            height: "100%",
            display: photo ? "flex" : "none",
            background: "#f2f2f2",
          }}
        >
          {photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo}
              alt=""
              style={{ width: 540, height: 630, objectFit: "cover" }}
            />
          )}
        </div>
        <div
          style={{
            flex: 1,
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 24,
            padding: "56px 64px",
            background: BLEU_MARQUE,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt="" width={72} height={72} style={{ borderRadius: 16 }} />
          <div style={{ display: "flex", fontSize: 48, fontWeight: 700, color: "#FEFDFF", lineHeight: 1.2 }}>
            {produit ? produit.nom.slice(0, 80) : "SacAdo"}
          </div>
          {produit && (
            <div style={{ display: "flex", fontSize: 40, fontWeight: 600, color: "#E07B39" }}>
              {prixAffiche}
            </div>
          )}
          <div style={{ display: "flex", fontSize: 26, color: "#FEFDFF", opacity: 0.85 }}>
            Fournitures scolaires — livraison partout au Sénégal
          </div>
        </div>
      </div>
    ),
    {
      width: LARGEUR,
      height: HAUTEUR,
      fonts: [{ name: "Geist", data: police, weight: 400, style: "normal" }],
    },
  );

  const png = Buffer.from(await image.arrayBuffer());
  // Qualité 70 : marge confortable sous 300 Ko même avec une photo produit
  // riche en détails, sans compression visible à la taille d'un aperçu de lien.
  let jpeg = await sharp(png).jpeg({ quality: 70 }).toBuffer();
  if (jpeg.byteLength > 300 * 1024) {
    jpeg = await sharp(png).jpeg({ quality: 50 }).toBuffer();
  }

  return new Response(new Uint8Array(jpeg), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
