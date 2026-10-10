"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Tag } from "lucide-react";
import { getPromoExpressMoi, type PromoExpressMoi } from "@/lib/promo-express-public-actions";

function formatDateAvecJour(iso: string): string {
  const [annee, mois, jour] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(annee, mois - 1, jour, 12));
  const libelle = date.toLocaleDateString("fr-FR", { weekday: "long", timeZone: "Africa/Dakar" });
  return `${libelle} ${String(jour).padStart(2, "0")}/${String(mois).padStart(2, "0")}`;
}

export default function MoiPromosPage() {
  const [promo, setPromo] = useState<PromoExpressMoi | null>(null);

  useEffect(() => {
    getPromoExpressMoi().then(setPromo);
  }, []);

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <Link href="/moi" className="inline-flex items-center gap-1 text-xs font-medium text-ink/50">
        <ArrowLeft size={13} aria-hidden="true" />
        Moi
      </Link>
      <h1 className="font-heading text-xl font-bold text-ink">Promos</h1>

      {!promo ? null : promo.actif ? (
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-action/25 bg-action/10 p-5">
          <span className="flex size-10 items-center justify-center rounded-full bg-action/20 text-action">
            <Tag size={18} aria-hidden="true" />
          </span>
          <p className="text-sm font-semibold text-ink">
            Aujourd&apos;hui, la livraison express est au prix normal, jusqu&apos;à {promo.heureLimite}.
          </p>
          <Link
            href="/categories"
            className="inline-flex h-10 items-center rounded-full bg-brand px-4 text-sm font-semibold text-on-brand"
          >
            Voir le catalogue
          </Link>
        </div>
      ) : (
        <div className="flex flex-col items-start gap-2 rounded-2xl border border-ink/10 bg-elevated p-5">
          <p className="text-sm text-ink/70">Pas de promo en cours.</p>
          {promo.prochaineDate && (
            <p className="text-sm text-ink/55">
              Prochaine : <span className="font-medium text-ink">{formatDateAvecJour(promo.prochaineDate)}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
