"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BellRing,
  BookOpen,
  ClipboardList,
  FileText,
  FolderTree,
  GraduationCap,
  History,
  Landmark,
  Layers,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  MapPin,
  MapPinned,
  MessageSquareText,
  Package,
  PackageCheck,
  PackageSearch,
  Repeat2,
  ShieldCheck,
  SlidersHorizontal,
  TriangleAlert,
  Truck,
  Wallet,
  Warehouse,
  Users,
} from "lucide-react";
import { signOut } from "@/lib/admin/auth-actions";
import { RechercheAllerA } from "./recherche-aller-a";

// Les 26 onglets admin. Les 5 premiers (Accueil, Commandes, Livraisons,
// Produits, Kits) sont les entrées de la bottom nav mobile (AdminBottomNav) ;
// tous les autres sont regroupés par thème sur /admin/plus (GROUPES_PLUS
// ci-dessous). Source commune pour la recherche "Aller à…".
export const LIENS = [
  { href: "/admin", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/admin/livraisons", label: "Livraisons", icon: Truck },
  { href: "/admin/preparations", label: "Préparations", icon: PackageCheck },
  { href: "/admin/commandes", label: "Commandes", icon: ClipboardList },
  { href: "/admin/produits", label: "Produits", icon: Package },
  { href: "/admin/prix-a-verifier", label: "Prix à vérifier", icon: TriangleAlert },
  { href: "/admin/editions", label: "Éditions", icon: History },
  { href: "/admin/classement", label: "Classement accueil", icon: ListOrdered },
  { href: "/admin/moderation", label: "Modération vendeurs", icon: ShieldCheck },
  { href: "/admin/categories", label: "Catégories", icon: FolderTree },
  { href: "/admin/attributs", label: "Attributs", icon: SlidersHorizontal },
  { href: "/admin/synonymes", label: "Synonymes", icon: Repeat2 },
  { href: "/admin/recherches", label: "Ce que les clients cherchent", icon: PackageSearch },
  { href: "/admin/modeles", label: "Modèles de messages", icon: MessageSquareText },
  { href: "/admin/notifications", label: "Notifications", icon: BellRing },
  { href: "/admin/kits", label: "Kits", icon: GraduationCap },
  { href: "/admin/classes", label: "Classes", icon: Layers },
  { href: "/admin/ebooks", label: "Ebooks", icon: BookOpen },
  { href: "/admin/documents", label: "Notices de kits", icon: FileText },
  { href: "/admin/zones", label: "Groupes de livraison", icon: MapPin },
  { href: "/admin/localites", label: "Localités", icon: MapPinned },
  { href: "/admin/lieux-speciaux", label: "Lieux spéciaux", icon: Landmark },
  { href: "/admin/fournisseurs", label: "Fournisseurs", icon: Warehouse },
  { href: "/admin/ventes", label: "Articles vendus", icon: BarChart3 },
  { href: "/admin/clients", label: "Clients", icon: Users },
  { href: "/admin/comptabilite", label: "Comptabilité", icon: Wallet },
] as const;

function estActif(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

function ListeLiens({ pathname }: { pathname: string }) {
  return (
    <>
      {LIENS.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={`flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-sm transition-colors ${
            estActif(pathname, href)
              ? "bg-brand/10 font-medium text-brand"
              : "text-ink/70 hover:bg-ink/5"
          }`}
        >
          <Icon size={17} aria-hidden="true" />
          {label}
        </Link>
      ))}
      <form action={signOut} className="mt-2 border-t border-ink/10 pt-2">
        <button
          type="submit"
          className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-sm text-ink/60 transition-colors hover:bg-ink/5"
        >
          <LogOut size={17} aria-hidden="true" />
          Se déconnecter
        </button>
      </form>
    </>
  );
}

// Sidebar desktop seulement : sur mobile, la navigation principale est la
// bottom nav (AdminBottomNav) + la page /admin/plus (tiroir hamburger retiré,
// PROMPT_ADMIN Lot 2).
export function AdminNav({ email }: { email: string }) {
  const pathname = usePathname();

  return (
    <nav className="hidden w-56 shrink-0 flex-col gap-3 border-r border-ink/10 bg-white p-4 lg:flex">
      <div>
        <p className="font-heading text-sm font-bold text-ink">SacAdo Admin</p>
        <p className="truncate text-[11px] text-ink/40">{email}</p>
      </div>
      <RechercheAllerA liens={LIENS.map(({ href, label }) => ({ href, label }))} />
      <div className="flex flex-col gap-1 overflow-y-auto">
        <ListeLiens pathname={pathname} />
      </div>
    </nav>
  );
}
