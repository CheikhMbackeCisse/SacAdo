"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getBadges, marquerSectionVue, type Badges } from "@/lib/admin/lecture-actions";
import { ENTREES_PRINCIPALES as ENTREES } from "@/lib/admin/nav-liens";
import { BadgeCompte } from "./badge-compte";

function estActif(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

// Bottom nav mobile, 5 entrées (PROMPT_ADMIN_V2 Lot 1 : remplace les 6
// entrées de PROMPT_ADMIN Lot 2 — Produits et Livraison passent dans "Plus",
// "Trafic" apparaît). "Plus" regroupe tout le reste. Badge Commandes : nombre
// de commandes à confirmer par appel + payées à préparer, remis à zéro dès
// que l'onglet est ouvert.
export function AdminBottomNav() {
  const pathname = usePathname();
  const [badges, setBadges] = useState<Badges>({ commandes: 0 });
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
