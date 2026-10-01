"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { signOut } from "@/lib/admin/auth-actions";
import { LIENS } from "@/lib/admin/nav-liens";
import { RechercheAllerA } from "./recherche-aller-a";

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
