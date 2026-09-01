import type { LucideIcon } from "lucide-react";
import { GraduationCap, Home, LayoutGrid, ShoppingCart, User } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  // Icône de marque (PNG dans /public/images/). Prioritaire sur `icon` ;
  // affichée en masque teinté (voir components/layout/nav-icon.tsx).
  img?: string;
};

// Partagé entre la bottom nav (mobile) et la barre de nav du header (desktop,
// voir CLAUDE.md section 6 : "la nav peut devenir une barre haute ou latérale
// avec les 5 mêmes destinations").
// "Kits" est une entrée à part entière (produit phare mis en avant) ; l'ancienne
// entrée "Commandes" vit désormais dans la page "Moi".
export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Accueil", icon: Home, img: "/images/nav-accueil.png" },
  { href: "/categories", label: "Catégories", icon: LayoutGrid, img: "/images/nav-categories.png" },
  { href: "/kits", label: "Kits", icon: GraduationCap, img: "/images/nav-kits.png" },
  { href: "/panier", label: "Panier", icon: ShoppingCart },
  { href: "/moi", label: "Moi", icon: User },
];
