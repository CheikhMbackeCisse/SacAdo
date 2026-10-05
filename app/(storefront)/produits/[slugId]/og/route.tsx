import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { getProduitById } from "@/lib/supabase/queries";
import { origineSite, urlAbsolue } from "@/lib/site-url";
import { idDepuisSlug } from "@/lib/slug";

// Route dédiée (plutôt que la convention spéciale opengraph-image.tsx) : cette
// dernière ne sait produire que du PNG, et une vraie photo de produit encodée
// en PNG (sans perte) dépasse largement les 300 Ko tolérés par WhatsApp pour
// afficher un aperçu (testé : ~850 Ko). On repasse par `sharp` (déjà une
// dépendance du projet, utilisée par l'optimiseur next/image en prod) pour
// ressortir un JPEG compressé sous ce seuil.
export const revalidate = 3600;

const BLEU_MARQUE = "#0B3D91";
const ORANGE_ACTION = "#E07B39";
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
    const jpeg = await sharp(brut).resize(LARGEUR, HAUTEUR, { fit: "cover" }).jpeg({ quality: 80 }).toBuffer();
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
  // Toujours la photo pleine résolution de la fiche, jamais une vignette de
  // liste. Certains produits (placeholders de kit) stockent un chemin
  // relatif /public plutôt qu'une URL Supabase Storage absolue.
  const photoBrute = produit ? produit.photos[0] ?? produit.photo : null;
  const [photo, police] = await Promise.all([
    photoBrute ? photoEnDataUri(urlAbsolue(site, photoBrute)) : Promise.resolve(null),
    chargerPolice(),
  ]);

  const mention = (
    <div style={{ display: "flex", fontSize: 44, fontWeight: 700, color: "#FEFDFF" }}>
      Disponible sur&nbsp;<span style={{ color: ORANGE_ACTION }}>sacado.sn</span>
    </div>
  );

  // Juste le produit en plein cadre, avec la mention en bandeau par-dessus
  // (retour fondateur) : plus de logo ni de nom de produit qui dupliquaient
  // ce que WhatsApp affiche déjà via og:title. Sans photo (repli), la même
  // mention se retrouve centrée sur un fond bleu marque.
  const image = new ImageResponse(
    (
      <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", background: BLEU_MARQUE }}>
        {photo ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo}
              alt=""
              style={{ position: "absolute", top: 0, left: 0, width: LARGEUR, height: HAUTEUR, objectFit: "cover" }}
            />
            <div
              style={{
                position: "absolute",
                left: 0,
                bottom: 0,
                width: LARGEUR,
                display: "flex",
                justifyContent: "center",
                padding: "28px 0",
                background: "rgba(0, 19, 20, 0.55)",
              }}
            >
              {mention}
            </div>
          </>
        ) : (
          <div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center" }}>
            {mention}
          </div>
        )}
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
