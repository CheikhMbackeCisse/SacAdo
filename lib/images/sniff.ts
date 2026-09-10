// Contrôle du contenu réel d'un fichier image (AUDIT_SECURITE_3 F1) : le type
// MIME annoncé par le navigateur est falsifiable sur un appel direct. On lit les
// premiers octets (« magic bytes ») pour confirmer que c'est bien un JPEG / PNG
// / WebP et refuser un fichier non-image (script, HTML, SVG…) déguisé en image.

export const TYPES_IMAGE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const TAILLE_MAX_PHOTO = 3 * 1024 * 1024; // 3 Mo

export function snifferImage(octets: Uint8Array): "jpg" | "png" | "webp" | null {
  if (octets.length >= 3 && octets[0] === 0xff && octets[1] === 0xd8 && octets[2] === 0xff) {
    return "jpg";
  }
  if (
    octets.length >= 8 &&
    octets[0] === 0x89 && octets[1] === 0x50 && octets[2] === 0x4e && octets[3] === 0x47 &&
    octets[4] === 0x0d && octets[5] === 0x0a && octets[6] === 0x1a && octets[7] === 0x0a
  ) {
    return "png";
  }
  if (
    octets.length >= 12 &&
    octets[0] === 0x52 && octets[1] === 0x49 && octets[2] === 0x46 && octets[3] === 0x46 && // "RIFF"
    octets[8] === 0x57 && octets[9] === 0x45 && octets[10] === 0x42 && octets[11] === 0x50 // "WEBP"
  ) {
    return "webp";
  }
  return null;
}
