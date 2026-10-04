"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Phone, MessageCircle, Check, X, PhoneMissed } from "lucide-react";
import {
  changerStatutCommande,
  marquerAppelInjoignable,
} from "@/lib/admin/commandes-actions";
import { rendreModele } from "@/lib/messages/modeles";
import { normaliserTelephoneSN } from "@/lib/whatsapp";

function formatDateHeure(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Bloc "appel de confirmation" (PROMPT_ADMIN_V2 Lot 2) : Appeler + WhatsApp
// (message déjà prêt, modèle "commande_a_confirmer" chargé une fois par la
// page parente), puis les trois issues possibles de l'appel. Utilisé sur la
// carte de /admin/commandes et sur la fiche détaillée.
export function ConfirmationAppel({
  commandeId,
  clientNom,
  clientTelephone,
  telephoneNormalise,
  total,
  modeleWhatsApp,
  tentatives,
  dernierEssaiLe,
}: {
  commandeId: number;
  clientNom: string;
  clientTelephone: string;
  telephoneNormalise: string | null;
  total: number;
  modeleWhatsApp: string | null;
  tentatives: number;
  dernierEssaiLe: string | null;
}) {
  const router = useRouter();
  const [enCours, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  const numero = telephoneNormalise ?? normaliserTelephoneSN(clientTelephone);
  const prenom = clientNom.trim().split(/\s+/)[0] || "";
  const message = modeleWhatsApp
    ? rendreModele(modeleWhatsApp, {
        prenom,
        numero_commande: commandeId,
        montant: Math.round(total).toLocaleString("fr-FR"),
      })
    : null;
  const lienWhatsApp = numero && message ? `https://wa.me/${numero}?text=${encodeURIComponent(message)}` : null;
  const lienAppel = `tel:${numero ? `+${numero}` : clientTelephone}`;

  const agir = (action: "confirmer" | "injoignable" | "annuler") => {
    if (action === "annuler" && !window.confirm("Annuler cette commande et libérer le stock ?")) return;
    setErreur(null);
    startTransition(async () => {
      const res =
        action === "confirmer"
          ? await changerStatutCommande(commandeId, "recue")
          : action === "annuler"
            ? await changerStatutCommande(commandeId, "annulee")
            : await marquerAppelInjoignable(commandeId);
      if (!res.ok) {
        setErreur(res.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-brand/30 bg-brand/5 p-3">
      <div className="flex flex-wrap gap-2">
        <a
          href={lienAppel}
          className="flex min-h-9 items-center gap-1.5 rounded-full border border-ink/15 bg-white px-3 text-xs font-semibold text-ink/80"
        >
          <Phone size={14} aria-hidden="true" />
          Appeler
        </a>
        {lienWhatsApp && (
          <a
            href={lienWhatsApp}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-9 items-center gap-1.5 rounded-full border border-ink/15 bg-white px-3 text-xs font-semibold text-ink/80"
          >
            <MessageCircle size={14} aria-hidden="true" />
            WhatsApp
          </a>
        )}
      </div>

      {tentatives > 0 && (
        <p className="text-[11px] text-ink/50">
          Injoignable {tentatives}×{dernierEssaiLe ? ` — dernier essai le ${formatDateHeure(dernierEssaiLe)}` : ""}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={enCours}
          onClick={() => agir("confirmer")}
          className="flex min-h-9 items-center gap-1.5 rounded-full bg-brand px-3 text-xs font-semibold text-on-brand disabled:opacity-50"
        >
          <Check size={14} aria-hidden="true" />
          Confirmée
        </button>
        <button
          type="button"
          disabled={enCours}
          onClick={() => agir("injoignable")}
          className="flex min-h-9 items-center gap-1.5 rounded-full border border-ink/15 bg-white px-3 text-xs font-medium text-ink/70 disabled:opacity-50"
        >
          <PhoneMissed size={14} aria-hidden="true" />
          Injoignable
        </button>
        <button
          type="button"
          disabled={enCours}
          onClick={() => agir("annuler")}
          className="flex min-h-9 items-center gap-1.5 rounded-full border border-red-300 bg-white px-3 text-xs font-medium text-red-600 disabled:opacity-50"
        >
          <X size={14} aria-hidden="true" />
          Annulée
        </button>
      </div>

      {erreur && <p className="text-xs text-red-600">{erreur}</p>}
    </div>
  );
}
