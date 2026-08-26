import { ClipboardList, Home, LayoutGrid, ShoppingCart, User } from "lucide-react";

// Partagé entre la bottom nav (mobile) et la barre de nav du header (desktop,
// voir CLAUDE.md section 6 : "la nav peut devenir une barre haute ou latérale
// avec les 5 mêmes destinations").
export const NAV_ITEMS = [
  { href: "/", label: "Accueil", icon: Home },
  { href: "/categories", label: "Catégories", icon: LayoutGrid },
  { href: "/panier", label: "Panier", icon: ShoppingCart },
  { href: "/commandes", label: "Commandes", icon: ClipboardList },
  { href: "/moi", label: "Moi", icon: User },
] as const;
