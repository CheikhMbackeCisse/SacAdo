"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, GraduationCap, LayoutDashboard, Menu, Package, Truck } from "lucide-react";
import { getBadges, marquerSectionVue, type Badges } from "@/lib/admin/lecture-actions";
import { BadgeCompte } from "./badge-compte";

type Section = "commandes" | "livraisons";

const ENTREES: { href: string; label: string; icon: typeof LayoutDashboard; section?: Section }[] = [
  { href: "/admin", label: "Accueil", icon: LayoutDashboard },
  { href: "/admin/commandes", label: "Commandes", icon: ClipboardList, section: "commandes" },
  { href: "/admin/livraisons", label: "Livraison", icon: Truck, section: "livraisons" },
  { href: "/admin/produits", label: "Produits", icon: Package },
  { href: "/admin/kits", label: "Kits", icon: GraduationCap },
  { href: "/admin/plus", label: "Plus", icon: Menu },
];

function estActif(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

// Bottom nav mobile, 6 entrées (PROMPT_ADMIN Lot 2). Remplace le tiroir
// hamburger comme navigation principale sur téléphone ; "Plus" regroupe tout
// le reste. Badges Commandes/Livraison : nombre non vu, remis à zéro dès que
// l'onglet correspondant est ouvert.
export function AdminBottomNav() {
  const pathname = usePathname();
  const [badges, setBadges] = useState<Badges>({ commandes: 0, livraisons: 0 });
  const vuPour = useRef<string | null>(null);

  useEffect(() => {
    let annule = false;
    getBadges()
      .then((b) => {
        if (!annule) setBadges(b);
      })
      .catch(() => {});
    return () => {
      annule = true;
    };
  }, [pathname]);

  useEffect(() => {
    const entree = ENTREES.find((e) => e.section && estActif(pathname, e.href));
    const section = entree?.section;
    if (!section || vuPour.current === pathname) return;
    vuPour.current = pathname;
    marquerSectionVue(section)
      .then(() => setBadges((b) => ({ ...b, [section]: 0 })))
      .catch(() => {});
  }, [pathname]);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch border-t border-ink/10 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
      aria-label="Navigation principale"
    >
      {ENTREES.map(({ href, label, icon: Icon, section }) => {
        const compteur = section ? badges[section] : 0;
        const actif = estActif(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] ${
              actif ? "text-brand" : "text-ink/50"
            }`}
          >
            <span className="relative">
              <Icon size={20} aria-hidden="true" />
              <BadgeCompte valeur={compteur} />
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
