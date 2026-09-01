"use client";

// Compresse une image AVANT upload : les connexions mobiles sénégalaises sont
// lentes et les photos de téléphone font plusieurs Mo (CLAUDE.md : images
// < 200 Ko). Redimensionne au plus grand côté puis ré-encode en WebP.
// En cas d'échec (navigateur ancien, fichier non image), renvoie le fichier
// d'origine — l'upload serveur garde son plafond de 3 Mo comme garde-fou.

const COTE_MAX = 1400;
const QUALITE = 0.82;
const CIBLE_OCTETS = 200 * 1024;

export async function compresserImage(fichier: File): Promise<File> {
  if (!fichier.type.startsWith("image/") || typeof createImageBitmap !== "function") {
    return fichier;
  }

  try {
    const bitmap = await createImageBitmap(fichier);
    const ratio = Math.min(1, COTE_MAX / Math.max(bitmap.width, bitmap.height));
    const largeur = Math.round(bitmap.width * ratio);
    const hauteur = Math.round(bitmap.height * ratio);

    const canvas = document.createElement("canvas");
    canvas.width = largeur;
    canvas.height = hauteur;
    const ctx = canvas.getContext("2d");
    if (!ctx) return fichier;
    ctx.drawImage(bitmap, 0, 0, largeur, hauteur);
    bitmap.close?.();

    // Deux passes : si la première dépasse encore la cible, on baisse la qualité.
    let blob = await versBlob(canvas, QUALITE);
    if (blob && blob.size > CIBLE_OCTETS) {
      const seconde = await versBlob(canvas, 0.6);
      if (seconde && seconde.size < blob.size) blob = seconde;
    }

    if (!blob || blob.size >= fichier.size) return fichier;
    const base = fichier.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${base}.webp`, { type: "image/webp" });
  } catch {
    return fichier;
  }
}

function versBlob(canvas: HTMLCanvasElement, qualite: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/webp", qualite));
}
