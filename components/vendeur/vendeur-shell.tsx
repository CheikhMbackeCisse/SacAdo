"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  Handshake,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  PlusCircle,
  Store,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { signOutVendeur } from "@/lib/vendeur/auth-actions";
import { NavigationGuardProvider } from "@/components/ui/navigation-guard";

type Entree = {
  href: string;
  label: string;
  icon: typeof Package;
  exact?: boolean;
  badge?: "messages";
  bientot?: boolean;
};

const ENTREES: Entree[] = [
  { href: "/vendeur", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
  { href: "/vendeur/produits", label: "Mes produits", icon: Package },
  { href: "/vendeur/produits/nouveau", label: "Ajouter un produit", icon: PlusCircle },
  { href: "/vendeur/ventes", label: "Mes ventes", icon: TrendingUp },
  { href: "/vendeur/negociations", label: "Négociations", icon: Handshake },
  { href: "/vendeur/messages", label: "Boîte de réception", icon: Inbox, badge: "messages" },
  { href: "/vendeur/reversements", label: "Reversements", icon: Wallet, bientot: true },
  { href: "/vendeur/profil", label: "Profil boutique", icon: Store },
];

function estActif(pathname: string, entree: Entree): boolean {
  if (entree.exact) return pathname === entree.href;
  // "Ajouter un produit" ne doit pas rester actif quand on est sur "Mes produits".
  if (entree.href === "/vendeur/produits") {
    return pathname === "/vendeur/produits" || pathname.startsWith("/vendeur/produits/");
  }
  return pathname === entree.href || pathname.startsWith(`${entree.href}/`);
}

export function VendeurShell({
  nomBoutique,
  nbMessagesNonLus = 0,
  children,
}: {
  nomBoutique: string;
  nbMessagesNonLus?: number;
  children: React.ReactNode;
}) {
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

  const fermer = () => setOuvert(false);

  return (
    <div className="min-h-screen bg-[#001314]/[0.03]">
      <header className="sticky top-0 z-40 border-b border-[#001314]/10 bg-white">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => setOuvert(true)}
            aria-label="Ouvrir le menu"
            className="relative flex size-10 shrink-0 items-center justify-center rounded-xl text-[#001314]/70 transition-colors hover:bg-[#001314]/[0.05] active:scale-90"
          >
            <Menu size={22} aria-hidden="true" />
            {nbMessagesNonLus > 0 && (
              <span
                className="absolute right-1.5 top-1.5 size-2 rounded-full bg-[#E07B39]"
                aria-hidden="true"
              />
            )}
          </button>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-[#001314]/45">Espace vendeur SacAdo</p>
            <p className="truncate font-heading text-sm font-bold text-[#001314]">{nomBoutique}</p>
          </div>
        </div>
      </header>

      {ouvert && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={fermer}
            className="absolute inset-0 bg-[#001314]/40"
          />
          <nav className="animate-fade-in-up absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col gap-1 overflow-y-auto bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-[#001314]/45">Espace vendeur</p>
                <p className="truncate font-heading text-sm font-bold text-[#001314]">
                  {nomBoutique}
                </p>
              </div>
              <button
                type="button"
                aria-label="Fermer le menu"
                onClick={fermer}
                className="-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 text-[#001314]/50 hover:bg-[#001314]/5"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            {ENTREES.map((entree) => {
              const { href, label, icon: Icon, badge, bientot } = entree;
              if (bientot) {
                return (
                  <span
                    key={href}
                    className="flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-sm text-[#001314]/35"
                  >
                    <Icon size={17} aria-hidden="true" />
                    {label}
                    <span className="ml-auto rounded-full bg-[#001314]/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-[#001314]/45">
                      Bientôt
                    </span>
                  </span>
                );
              }
              const actif = estActif(pathname, entree);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={fermer}
                  className={`flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-sm transition-colors ${
                    actif
                      ? "bg-[#0B3D91]/10 font-medium text-[#0B3D91]"
                      : "text-[#001314]/70 hover:bg-[#001314]/5"
                  }`}
                >
                  <Icon size={17} aria-hidden="true" />
                  {label}
                  {badge === "messages" && nbMessagesNonLus > 0 && (
                    <span className="ml-auto inline-flex min-w-4 items-center justify-center rounded-full bg-[#E07B39] px-1 text-[10px] font-bold text-[#001314]">
                      {nbMessagesNonLus}
                    </span>
                  )}
                </Link>
              );
            })}

            <div className="mt-2 flex flex-col gap-1 border-t border-[#001314]/10 pt-2">
              <Link
                href="/"
                onClick={fermer}
                className="flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-sm text-[#001314]/70 transition-colors hover:bg-[#001314]/5"
              >
                <ArrowLeft size={17} aria-hidden="true" />
                Retour à l’espace client
              </Link>
              <form action={signOutVendeur}>
                <button
                  type="submit"
                  className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-sm text-[#001314]/60 transition-colors hover:bg-[#001314]/5"
                >
                  <LogOut size={17} aria-hidden="true" />
                  Déconnexion
                </button>
              </form>
            </div>
          </nav>
        </div>
      )}

      <main className="mx-auto w-full max-w-4xl px-4 py-6">
        <NavigationGuardProvider>{children}</NavigationGuardProvider>
      </main>
    </div>
  );
}
