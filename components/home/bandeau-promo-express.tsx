"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { getPromoExpressBandeau } from "@/lib/promo-express-public-actions";

const CLE_STOCKAGE = "sacado_bandeau_promo_ferme_le";

function aujourdhui(): string {
  return new Date().toISOString().slice(0, 10);
}

function dejaFermeAujourdhui(): boolean {
  try {
    return localStorage.getItem(CLE_STOCKAGE) === aujourdhui();
  } catch {
    return false;
  }
}

function fermerPourAujourdhui(): void {
  try {
    localStorage.setItem(CLE_STOCKAGE, aujourdhui());
  } catch {
    // Stockage indisponible (navigation privée…) : pas bloquant, le bandeau
    // revient simplement à la prochaine ouverture.
  }
}

// Bandeau sobre, jours promo uniquement (Lot 4e, CLAUDE.md §5 : pas de compte
// à rebours, rien qui clignote). Chargé côté client pour ne pas désactiver le
// cache ISR de l'accueil — la promo est un état qui change dans la journée.
export function BandeauPromoExpress() {
  const [promo, setPromo] = useState<{ actif: boolean; heureLimite: string } | null>(null);
  const [ferme, setFerme] = useState(true);

  useEffect(() => {
    getPromoExpressBandeau().then((r) => {
      setPromo(r);
      setFerme(dejaFermeAujourdhui());
    });
  }, []);

  if (!promo?.actif || ferme) return null;

  return (
    <div className="mx-4 mt-2 flex items-center gap-2 rounded-xl bg-action/10 px-3 py-2 text-xs text-ink">
      <p className="min-w-0 flex-1">
        Aujourd&apos;hui, la livraison express est au prix normal, jusqu&apos;à {promo.heureLimite}.{" "}
        <Link href="/moi/promos" className="font-semibold text-action underline">
          En savoir plus
        </Link>
      </p>
      <button
        type="button"
        onClick={() => {
          fermerPourAujourdhui();
          setFerme(true);
        }}
        aria-label="Fermer"
        className="shrink-0 text-ink/40 hover:text-ink"
      >
        <X size={14} />
      </button>
    </div>
  );
}
