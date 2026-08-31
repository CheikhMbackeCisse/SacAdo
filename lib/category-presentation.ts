import type { LucideIcon } from "lucide-react";
import {
  Armchair,
  BookOpen,
  Cpu,
  Download,
  Droplets,
  Dumbbell,
  GraduationCap,
  Laptop,
  Library,
  Package,
  Palette,
  PenLine,
  Ruler,
  ShoppingBag,
  Tag,
} from "lucide-react";
import type { Categorie } from "@/lib/supabase/types";

// Habillage des catégories qui ne vit pas en base : l'icône Lucide (composant
// React) et les exemples de recherche affichés en placeholder. Indexé par slug.
// Une catégorie créée en admin sans entrée ici retombe sur des valeurs par défaut.
type Habillage = { icon: LucideIcon; placeholders: string[] };

const HABILLAGE: Record<string, Habillage> = {
  kits: { icon: Package, placeholders: ["Kit CP", "Kit 6e", "Kit maternelle"] },
  "cahiers-papeterie": {
    icon: BookOpen,
    placeholders: ["Cahier 200 pages", "Cahier Prestige", "Pochette plastique"],
  },
  ecriture: { icon: PenLine, placeholders: ["Stylo bille", "Crayon HB", "Gomme"] },
  geometrie: {
    icon: Ruler,
    placeholders: ["Calculatrice scientifique", "Compas", "Équerre"],
  },
  "cartables-sacs": {
    icon: ShoppingBag,
    placeholders: ["Cartable", "Sac à dos", "Trousse"],
  },
  "livres-manuels": {
    icon: Library,
    placeholders: ["Livre de maths 3e", "Roman au programme", "Dictionnaire français"],
  },
  ordinateurs: {
    icon: Laptop,
    placeholders: ["Ordinateur portable", "Souris", "Clé USB"],
  },
  "electronique-arduino": {
    icon: Cpu,
    placeholders: ["Arduino", "Calculatrice graphique", "Piles"],
  },
  "art-dessin": {
    icon: Palette,
    placeholders: ["Peinture gouache", "Pinceau", "Crayons de couleur"],
  },
  mobilier: { icon: Armchair, placeholders: ["Table d'écolier", "Chaise", "Bureau"] },
  "fournitures-ecole": {
    icon: GraduationCap,
    placeholders: ["Tableau ardoise", "Tablier", "Étiquettes"],
  },
  "sport-eps": {
    icon: Dumbbell,
    placeholders: ["Tenue de sport", "Chaussures de sport", "Ballon"],
  },
  "hygiene-cantine": {
    icon: Droplets,
    placeholders: ["Gourde", "Boîte à goûter", "Trousse de toilette"],
  },
  ebooks: {
    icon: Download,
    placeholders: ["Ebook mathématiques", "Guide méthodologie", "Livre numérique"],
  },
};

export const DEFAULT_PLACEHOLDERS = [
  "Cahier 200 pages",
  "Cahier Prestige",
  "Calculatrice scientifique",
  "Cartable",
];

export function iconePourCategorie(slug: string): LucideIcon {
  return HABILLAGE[slug]?.icon ?? Tag;
}

export function placeholdersPourCategorie(slug: string | null | undefined): string[] {
  if (!slug) return DEFAULT_PLACEHOLDERS;
  return HABILLAGE[slug]?.placeholders ?? DEFAULT_PLACEHOLDERS;
}

// "Kits scolaires" est une catégorie du référentiel mais ses articles vivent
// dans la table kits : son lien pointe vers le parcours kits dédié.
export function hrefCategorie(categorie: Pick<Categorie, "slug">): string {
  return categorie.slug === "kits" ? "/kits" : `/categorie/${categorie.slug}`;
}

// Slug de catégorie déduit du chemin courant ("/categorie/ecriture" -> "ecriture",
// "/kits..." -> "kits"), pour adapter le placeholder de recherche.
export function slugCategorieDepuisPath(pathname: string): string | null {
  if (pathname.startsWith("/categorie/")) {
    return pathname.split("/")[2] || null;
  }
  if (pathname === "/kits" || pathname.startsWith("/kits/")) return "kits";
  return null;
}
