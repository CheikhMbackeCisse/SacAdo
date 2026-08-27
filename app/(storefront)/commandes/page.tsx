"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { useIdentite } from "@/lib/local/identite";
import { getCommandesParTelephone } from "@/lib/moi/actions";
import { formatPrice } from "@/lib/format";
import { PhoneLookupForm } from "@/components/moi/phone-lookup-form";
import { EmptyState } from "@/components/ui/empty-state";
import type { Commande, StatutCommande } from "@/lib/supabase/types";

const LABELS_STATUT: Record<StatutCommande, string> = {
  recue: "Reçue",
  preparation: "En préparation",
  livraison: "En livraison",
  livree: "Livrée",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function MesCommandesPage() {
  const { identite } = useIdentite();
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!identite) return;
    getCommandesParTelephone(identite.telephone)
      .then(setCommandes)
      .finally(() => setLoading(false));
  }, [identite]);

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <h1 className="font-heading text-xl font-bold text-ink">Mes commandes</h1>

      {!identite ? (
        <PhoneLookupForm />
      ) : loading ? (
        <p className="text-sm text-ink/50">Chargement…</p>
      ) : commandes.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Vous n'avez pas encore de commande"
          description="Vos commandes apparaîtront ici une fois passées."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {commandes.map((commande) => (
            <Link
              key={commande.id}
              href={`/suivi/${commande.id}`}
              className="flex flex-col gap-1 rounded-2xl border border-ink/10 bg-elevated p-3 active:bg-ink/5"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-ink">Commande #{commande.id}</span>
                <span
                  className={`text-xs font-medium ${
                    commande.statut === "livree" ? "text-success" : "text-ink/60"
                  }`}
                >
                  {LABELS_STATUT[commande.statut]}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-ink/50">
                <span>{formatDate(commande.date)}</span>
                <span className="font-semibold text-ink">{formatPrice(commande.total)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
