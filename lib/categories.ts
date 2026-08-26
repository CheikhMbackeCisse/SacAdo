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
} from "lucide-react";

export type SousCategorie = {
  label: string;
  // mots-clés cherchés dans produits.nom pour filtrer — solution provisoire
  // tant qu'il n'existe pas de vrai référentiel de sous-catégories illustrées
  // (pas de table dédiée, voir décision Lot 1 : produits.categorie reste du texte libre).
  keywords: string[];
};

export type Categorie = {
  slug: string;
  nom: string;
  icon: LucideIcon;
  // chemin de la photo de catégorie sous /public/images ; absent tant que la
  // vraie photo n'a pas été fournie (CLAUDE.md section 7) -> fallback icône.
  image?: string;
  href: string;
  // valeur exacte de produits.categorie ; null pour "Kits scolaires" qui vit
  // dans la table kits, pas dans produits.
  categorieDb: string | null;
  sousCategories: SousCategorie[];
  // exemples concrets affichés en placeholder de la barre de recherche quand
  // on est dans cette catégorie.
  placeholders: string[];
};

export const CATEGORIES: Categorie[] = [
  {
    slug: "kits",
    nom: "Kits scolaires",
    icon: Package,
    image: "/images/cat-kits.png",
    href: "/kits",
    categorieDb: null,
    sousCategories: [],
    placeholders: ["Kit CP", "Kit 6e", "Kit maternelle"],
  },
  {
    slug: "cahiers-papeterie",
    nom: "Cahiers & papeterie",
    icon: BookOpen,
    image: "/images/cat-cahiers-papeterie.jpg",
    href: "/categorie/cahiers-papeterie",
    categorieDb: "Cahiers & papeterie",
    sousCategories: [
      { label: "Cahiers", keywords: ["cahier"] },
      { label: "Papier", keywords: ["ramette", "papier"] },
      { label: "Pochettes", keywords: ["pochette"] },
    ],
    placeholders: ["Cahier 200 pages", "Cahier Prestige", "Pochette plastique"],
  },
  {
    slug: "ecriture",
    nom: "Écriture",
    icon: PenLine,
    image: "/images/cat-ecriture.webp",
    href: "/categorie/ecriture",
    categorieDb: "Écriture",
    sousCategories: [
      { label: "Stylos", keywords: ["stylo"] },
      { label: "Crayons", keywords: ["crayon"] },
      { label: "Correction", keywords: ["correcteur", "gomme", "taille-crayon"] },
    ],
    placeholders: ["Stylo bille", "Crayon HB", "Gomme"],
  },
  {
    slug: "geometrie",
    nom: "Matériel géométrique",
    icon: Ruler,
    image: "/images/cat-geometrie.jpg",
    href: "/categorie/geometrie",
    categorieDb: "Géométrie",
    sousCategories: [
      { label: "Instruments", keywords: ["compas", "équerre", "equerre", "rapporteur", "règle", "regle"] },
      { label: "Calculatrices", keywords: ["calculatrice"] },
    ],
    placeholders: ["Calculatrice scientifique", "Compas", "Équerre"],
  },
  {
    slug: "cartables-sacs",
    nom: "Cartables & sacs",
    icon: ShoppingBag,
    image: "/images/cat-cartables-sacs.webp",
    href: "/categorie/cartables-sacs",
    categorieDb: "Cartables & sacs",
    sousCategories: [
      { label: "Cartables", keywords: ["cartable"] },
      { label: "Sacs à dos", keywords: ["sac à dos", "sac a dos"] },
      { label: "Trousses", keywords: ["trousse"] },
    ],
    placeholders: ["Cartable", "Sac à dos", "Trousse"],
  },
  {
    slug: "livres-manuels",
    nom: "Livres & manuels",
    icon: Library,
    image: "/images/cat-livres-manuels.jpg",
    href: "/categorie/livres-manuels",
    categorieDb: "Livres & manuels",
    sousCategories: [
      { label: "Dictionnaires", keywords: ["dictionnaire"] },
      { label: "Cahiers d'exercices", keywords: ["exercice"] },
      { label: "Livres de lecture", keywords: ["lecture"] },
    ],
    placeholders: ["Livre de maths 3e", "Roman au programme", "Dictionnaire français"],
  },
  {
    slug: "ordinateurs",
    nom: "Matériel informatique",
    icon: Laptop,
    image: "/images/cat-ordinateurs.jpg",
    href: "/categorie/ordinateurs",
    categorieDb: "Ordinateurs",
    sousCategories: [
      { label: "Ordinateurs", keywords: ["ordinateur"] },
      { label: "Accessoires", keywords: ["souris", "clé usb", "cle usb"] },
    ],
    placeholders: ["Ordinateur portable", "Souris", "Clé USB"],
  },
  {
    slug: "electronique-arduino",
    nom: "Électronique",
    icon: Cpu,
    image: "/images/cat-electronique-arduino.jpg",
    href: "/categorie/electronique-arduino",
    categorieDb: "Électronique & Arduino",
    sousCategories: [
      { label: "Arduino", keywords: ["arduino"] },
      { label: "Calculatrices graphiques", keywords: ["calculatrice graphique"] },
    ],
    placeholders: ["Arduino", "Calculatrice graphique", "Piles"],
  },
  {
    slug: "art-dessin",
    nom: "Art & dessin",
    icon: Palette,
    image: "/images/cat-art-dessin.jpg",
    href: "/categorie/art-dessin",
    categorieDb: "Art & dessin",
    sousCategories: [
      { label: "Coloriage", keywords: ["crayons de couleur"] },
      { label: "Peinture", keywords: ["peinture", "gouache"] },
      { label: "Dessin", keywords: ["dessin", "pinceau"] },
    ],
    placeholders: ["Peinture gouache", "Pinceau", "Crayons de couleur"],
  },
  {
    slug: "mobilier",
    nom: "Mobilier (tables, chaises)",
    icon: Armchair,
    image: "/images/hero-coin-etude.jpg",
    href: "/categorie/mobilier",
    categorieDb: "Mobilier",
    sousCategories: [],
    placeholders: ["Table d'écolier", "Chaise", "Bureau"],
  },
  {
    slug: "fournitures-ecole",
    nom: "Fournitures d'école",
    icon: GraduationCap,
    image: "/images/cat-fournitures-ecole.jpg",
    href: "/categorie/fournitures-ecole",
    categorieDb: "Fournitures d'école",
    sousCategories: [
      { label: "Tabliers", keywords: ["tablier"] },
      { label: "Ardoises", keywords: ["ardoise"] },
      { label: "Étiquettes", keywords: ["étiquette", "etiquette"] },
    ],
    placeholders: ["Tableau ardoise", "Tablier", "Étiquettes"],
  },
  {
    slug: "sport-eps",
    nom: "Sport & EPS",
    icon: Dumbbell,
    image: "/images/cat-sport-eps.jpg",
    href: "/categorie/sport-eps",
    categorieDb: "Sport & EPS",
    sousCategories: [],
    placeholders: ["Tenue de sport", "Chaussures de sport", "Ballon"],
  },
  {
    slug: "hygiene-cantine",
    nom: "Hygiène & cantine",
    icon: Droplets,
    image: "/images/cat-hygiene-cantine.png",
    href: "/categorie/hygiene-cantine",
    categorieDb: "Hygiène & cantine",
    sousCategories: [],
    placeholders: ["Gourde", "Boîte à goûter", "Trousse de toilette"],
  },
  {
    slug: "ebooks",
    nom: "Ebooks",
    icon: Download,
    image: "/images/cat-ebooks.webp",
    href: "/categorie/ebooks",
    categorieDb: "Ebooks",
    sousCategories: [],
    placeholders: ["Ebook mathématiques", "Guide méthodologie", "Livre numérique"],
  },
];

export function getCategorieBySlug(slug: string): Categorie | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}
