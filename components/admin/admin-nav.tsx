"use client";

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
  Package,
  ShieldCheck,
  Tags,
  Users,
} from "lucide-react";
import { signOut } from "@/lib/admin/auth-actions";

const LIENS = [
  { href: "/admin", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/admin/produits", label: "Produits", icon: Package },
  { href: "/admin/moderation", label: "Modération vendeurs", icon: ShieldCheck },
  { href: "/admin/categories", label: "Catégories", icon: FolderTree },
  { href: "/admin/sous-categories", label: "Sous-catégories", icon: Tags },
  { href: "/admin/kits", label: "Kits", icon: GraduationCap },
  { href: "/admin/zones", label: "Zones", icon: MapPin },
  { href: "/admin/commandes", label: "Commandes", icon: ClipboardList },
  { href: "/admin/ventes", label: "Articles vendus", icon: BarChart3 },
  { href: "/admin/clients", label: "Clients", icon: Users },
] as const;

export function AdminNav({ email }: { email: string }) {
  const pathname = usePathname();

  return (
    <nav className="flex w-56 shrink-0 flex-col gap-1 border-r border-ink/10 bg-white p-4">
      <div className="mb-4">
        <p className="font-heading text-sm font-bold text-ink">SacAdo Admin</p>
        <p className="truncate text-[11px] text-ink/40">{email}</p>
      </div>

      {LIENS.map(({ href, label, icon: Icon }) => {
        const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors ${
              active ? "bg-brand/10 font-medium text-brand" : "text-ink/70 hover:bg-ink/5"
            }`}
          >
            <Icon size={17} aria-hidden="true" />
            {label}
          </Link>
        );
      })}

      <form action={signOut} className="mt-4 border-t border-ink/10 pt-4">
        <button
          type="submit"
          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-ink/60 transition-colors hover:bg-ink/5"
        >
          <LogOut size={17} aria-hidden="true" />
          Se déconnecter
        </button>
      </form>
    </nav>
  );
}
