"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { mesurerVisite } from "@/lib/trafic/mesure-client";

// Page en erreur (PROMPT_ADMIN_V2 Lot 3 §6) : montée uniquement par
// app/(storefront)/not-found.tsx.
export function NotFoundTracker() {
  const pathname = usePathname();

  useEffect(() => {
    mesurerVisite({ type: "page_404", page: pathname });
  }, [pathname]);

  return null;
}
