import Link from "next/link";
import { LIENS_LEGAUX, MENTION_EDITEUR } from "@/lib/legal";

// Pied de page légal (TACHE_pages_legales_wave.md §5), présent sur toutes les
// pages du storefront via AppMain. Sobre et petit : ce n'est pas un élément
// de navigation principal, la bottom nav s'en charge.
export function LegalFooter() {
  return (
    <footer className="mt-8 flex flex-col items-center gap-2 border-t border-ink/10 px-4 py-5 text-center">
      <nav className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        {LIENS_LEGAUX.map((lien) => (
          <Link key={lien.href} href={lien.href} className="text-xs text-ink/50 hover:text-ink/70">
            {lien.label}
          </Link>
        ))}
      </nav>
      <p className="text-[11px] text-ink/40">{MENTION_EDITEUR}</p>
    </footer>
  );
}
