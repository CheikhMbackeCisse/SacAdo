// Loader next/image personnalisé (next.config.ts: images.loader = "custom") :
// remplace l'optimisation Vercel (/_next/image), dont le quota de
// transformations est presque épuisé. Ne fait AUCUNE transformation lui-même :
// il choisit juste, parmi les variantes déjà préparées par optimiser_images.py
// et téléversées telles quelles dans Supabase Storage, celle dont le nom de
// fichier correspond à la largeur demandée par next/image.
//
// Convention des fichiers (voir optimiser_images.py) : `<id>-400.webp` et
// `<id>-800.webp` existent TOUJOURS ; `<id>-1200.webp` n'existe que si la
// photo source dépassait 800 px de large. Ce loader (appelé pour générer un
// srcset entier, sans retour possible en cas d'échec) ne demande donc jamais
// la variante -1200 : seules -400 et -800 sont garanties. Le zoom plein écran
// (components/product/product-zoom.tsx) tente lui la -1200 séparément, via un
// <img> classique avec repli automatique sur la variante déjà affichée si le
// fichier n'existe pas — c'est la bonne place pour ce pari, pas ici.
//
// Toute autre image (logo, bannières, photos vendeur non préparées par ce
// script) ne correspond pas au motif attendu : le loader renvoie l'URL
// d'origine, sans transformation.

const SUPABASE_PRODUCT_PHOTO_PATH = "/storage/v1/object/public/produits/";
// Ancrée sur les seules largeurs réellement produites par optimiser_images.py
// (400/800/1200), jamais sur "n'importe quelle suite de chiffres" : un fichier
// téléversé à la main (UUID, numéro de modèle, "-1"/"-2" de numérotation) peut
// légitimement se terminer par des chiffres sans être une variante de taille.
// Bug réel corrigé le 2026-09-28 (voir AUDIT_SEO_2026-09-27.md, préambule) :
// avec `/-(\d+)(\.webp)$/i`, un UUID terminé par des chiffres (#1506, #1488),
// un "-1.webp"/"-2.webp" de numérotation (#1577) ou un numéro de modèle produit
// ("Stick 430" -> #1721) étaient pris à tort pour une variante -800, qui
// n'existait pas -> image cassée pour le visiteur.
const VARIANT_SUFFIX = /-(400|800|1200)(\.webp)$/i;
const KNOWN_WIDTHS = [400, 800] as const;

type LoaderParams = {
  src: string;
  width: number;
  quality?: number;
};

// Découpe une URL de photo produit en (base sans le -largeur, extension), ou
// `null` si elle ne suit pas la convention (auquel cas elle doit être servie
// telle quelle, jamais recomposée).
export function matchProductPhotoVariant(src: string): { base: string; ext: string } | null {
  if (!src.includes(SUPABASE_PRODUCT_PHOTO_PATH)) return null;

  const match = src.match(VARIANT_SUFFIX);
  if (!match || match.index === undefined) return null;

  return { base: src.slice(0, match.index), ext: match[2] };
}

export default function supabaseImageLoader({ src, width }: LoaderParams): string {
  const parsed = matchProductPhotoVariant(src);
  if (!parsed) return src;

  const target = KNOWN_WIDTHS.find((candidate) => candidate >= width) ?? KNOWN_WIDTHS[KNOWN_WIDTHS.length - 1];
  return `${parsed.base}-${target}${parsed.ext}`;
}
