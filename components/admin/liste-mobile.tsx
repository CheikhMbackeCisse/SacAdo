import type { ReactNode } from "react";

// Sur mobile les tableaux admin débordent : on affiche à la place une pile de
// cartes (ces composants), et le <table> passe en `hidden lg:block`
// (ADMIN_RESPONSIVE_ET_CARTE_LIVRAISON §1).

export function CartesListe({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-2.5 lg:hidden">{children}</div>;
}

export function CarteListe({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-ink/10 bg-white p-3.5 text-sm">
      {children}
    </div>
  );
}

export function ChampCarte({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="shrink-0 text-xs text-ink/50">{label}</span>
      <span className="min-w-0 text-right text-ink">{children}</span>
    </div>
  );
}

// Enveloppe du tableau desktop : caché sur mobile.
export function TableauDesktop({ children }: { children: ReactNode }) {
  return (
    <div className="hidden overflow-x-auto rounded-2xl border border-ink/10 bg-white lg:block">
      {children}
    </div>
  );
}
