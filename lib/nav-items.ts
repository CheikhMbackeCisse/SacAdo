import { GraduationCap, Home, LayoutGrid, ShoppingCart, User } from "lucide-react";

// Partagé entre la bottom nav (mobile) et la barre de nav du header (desktop,
// voir CLAUDE.md section 6 : "la nav peut devenir une barre haute ou latérale
// avec les 5 mêmes destinations").
// "Kits" est une entrée à part entière (produit phare mis en avant) ; l'ancienne
// entrée "Commandes" vit désormais dans la page "Moi".
export const NAV_ITEMS = [
  { href: "/", label: "Accueil", icon: Home },
  { href: "/categories", label: "Catégories", icon: LayoutGrid },
  { href: "/kits", label: "Kits", icon: GraduationCap },
  { href: "/panier", label: "Panier", icon: ShoppingCart },
  { href: "/moi", label: "Moi", icon: User },
] as const;
