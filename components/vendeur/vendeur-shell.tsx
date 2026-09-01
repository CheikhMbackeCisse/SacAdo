"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Inbox, LayoutDashboard, LogOut, Package, TrendingUp } from "lucide-react";
import { signOutVendeur } from "@/lib/vendeur/auth-actions";

const LIENS = [
  { href: "/vendeur", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
  { href: "/vendeur/produits", label: "Mes produits", icon: Package, exact: false },
  { href: "/vendeur/ventes", label: "Mes ventes", icon: TrendingUp, exact: false },
  { href: "/vendeur/messages", label: "Boîte de réception", icon: Inbox, exact: false },
] as const;

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

  return (
    <div className="min-h-screen bg-[#001314]/[0.03]">
      <header className="border-b border-[#001314]/10 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-[#001314]/45">Espace vendeur SacAdo</p>
            <p className="truncate font-heading text-sm font-bold text-[#001314]">{nomBoutique}</p>
          </div>
          <form action={signOutVendeur}>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-full border border-[#001314]/15 px-3 py-1.5 text-xs font-medium text-[#001314]/70 transition-colors hover:bg-[#001314]/[0.04]"
            >
              <LogOut size={14} aria-hidden="true" />
              Déconnexion
            </button>
          </form>
        </div>

        <nav className="mx-auto flex max-w-4xl gap-1 overflow-x-auto px-2 pb-1">
          {LIENS.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-t-lg border-b-2 px-3 py-2 text-sm transition-colors ${
                  active
                    ? "border-[#0B3D91] font-semibold text-[#0B3D91]"
                    : "border-transparent text-[#001314]/60 hover:text-[#001314]"
                }`}
              >
                <Icon size={16} aria-hidden="true" />
                {label}
                {href === "/vendeur/messages" && nbMessagesNonLus > 0 && (
                  <span className="ml-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-[#E07B39] px-1 text-[10px] font-bold text-[#001314]">
                    {nbMessagesNonLus}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-4xl px-4 py-6">{children}</main>
    </div>
  );
}
