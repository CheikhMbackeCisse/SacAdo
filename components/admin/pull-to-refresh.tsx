"use client";

import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { usePullToRefresh } from "@/lib/admin/use-pull-to-refresh";

// Enveloppe une liste admin pour ajouter le geste "tirer vers le bas pour
// actualiser" sur mobile (PROMPT_ADMIN.md Lot 3), sans transformer la page
// serveur elle-même en composant client.
export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { tirage, actualisation, seuil } = usePullToRefresh(() => router.refresh());

  return (
    <>
      <div
        className="flex items-center justify-center overflow-hidden text-ink/40 transition-[height] lg:hidden"
        style={{ height: actualisation ? 36 : tirage }}
      >
        <RefreshCw size={16} className={actualisation ? "animate-spin" : ""} aria-hidden="true" />
        {!actualisation && tirage > 0 && (
          <span className="ml-1.5 text-xs">{tirage >= seuil ? "Relâcher pour actualiser" : "Tirer pour actualiser"}</span>
        )}
      </div>
      {children}
    </>
  );
}
