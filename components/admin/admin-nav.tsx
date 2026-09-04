"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ClipboardList,
  FolderTree,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Package,
  ShieldCheck,
  SlidersHorizontal,
  Truck,
  Warehouse,
  Users,
  X,
} from "lucide-react";
import { signOut } from "@/lib/admin/auth-actions";

const LIENS = [
  { href: "/admin", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/admin/livraisons", label: "Livraisons", icon: Truck },
  { href: "/admin/commandes", label: "Commandes", icon: ClipboardList },
  { href: "/admin/produits", label: "Produits", icon: Package },
  { href: "/admin/moderation", label: "Modération vendeurs", icon: ShieldCheck },
  { href: "/admin/categories", label: "Catégories", icon: FolderTree },
  { href: "/admin/attributs", label: "Attributs", icon: SlidersHorizontal },
  { href: "/admin/kits", label: "Kits", icon: GraduationCap },
  { href: "/admin/zones", label: "Zones", icon: MapPin },
  { href: "/admin/fournisseurs", label: "Fournisseurs", icon: Warehouse },
  { href: "/admin/ventes", label: "Articles vendus", icon: BarChart3 },
  { href: "/admin/clients", label: "Clients", icon: Users },
] as const;

function estActif(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

function labelPage(pathname: string): string {
  const lien = [...LIENS].reverse().find((l) => estActif(pathname, l.href));
  return lien?.label ?? "Administration";
}

function ListeLiens({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      {LIENS.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={onNavigate}
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

export function AdminNav({ email }: { email: string }) {
  const pathname = usePathname();
  const [ouvert, setOuvert] = useState(false);

  useEffect(() => {
    if (!ouvert) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOuvert(false);
    };
    const root = document.documentElement;
    const avant = root.style.overflow;
    root.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      root.style.overflow = avant;
      window.removeEventListener("keydown", onKey);
    };
  }, [ouvert]);

  return (
    <>
      {/* Desktop : sidebar figée */}
      <nav className="hidden w-56 shrink-0 flex-col gap-1 border-r border-ink/10 bg-white p-4 lg:flex">
        <div className="mb-4">
          <p className="font-heading text-sm font-bold text-ink">SacAdo Admin</p>
          <p className="truncate text-[11px] text-ink/40">{email}</p>
        </div>
        <ListeLiens pathname={pathname} />
      </nav>

      {/* Mobile : barre du haut + tiroir */}
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-ink/10 bg-white px-3 lg:hidden">
        <button
          type="button"
          onClick={() => setOuvert(true)}
          aria-label="Ouvrir le menu"
          className="flex size-10 items-center justify-center rounded-xl text-ink/70 transition-colors hover:bg-ink/5 active:scale-90"
        >
          <Menu size={22} aria-hidden="true" />
        </button>
        <span className="truncate font-heading text-sm font-bold text-ink">
          {labelPage(pathname)}
        </span>
      </header>

      {ouvert && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={() => setOuvert(false)}
            className="absolute inset-0 bg-ink/40"
          />
          <nav className="animate-fade-in-up absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col gap-1 overflow-y-auto bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-heading text-sm font-bold text-ink">SacAdo Admin</p>
                <p className="truncate text-[11px] text-ink/40">{email}</p>
              </div>
              <button
                type="button"
                aria-label="Fermer le menu"
                onClick={() => setOuvert(false)}
                className="-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 text-ink/50 hover:bg-ink/5"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <ListeLiens pathname={pathname} onNavigate={() => setOuvert(false)} />
          </nav>
        </div>
      )}
    </>
  );
}
