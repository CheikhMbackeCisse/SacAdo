"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, MessageCircle } from "lucide-react";

// Bloc admin : le lien signé du bon de préparation + le bouton WhatsApp
// pré-rempli (NOTIFICATIONS_FOURNISSEURS §1, canal de secours).
export function LienFournisseur({
  lien,
  urlWhatsapp,
}: {
  lien: string;
  urlWhatsapp: string;
}) {
  const [copie, setCopie] = useState(false);

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(lien);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      setCopie(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-white p-4">
      <p className="text-xs font-medium text-ink/60">Lien à envoyer au fournisseur</p>
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={lien}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-lg border border-ink/15 bg-ink/[0.02] px-2.5 py-2 text-xs text-ink/70"
        />
        <button
          type="button"
          onClick={copier}
          aria-label="Copier le lien"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-ink/15 text-ink/60 hover:bg-ink/5"
        >
          {copie ? <Check size={15} className="text-success" /> : <Copy size={15} />}
        </button>
      </div>
      <div className="mt-1 flex flex-wrap gap-2">
        <a
          href={urlWhatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-10 items-center gap-1.5 rounded-full bg-brand px-4 text-sm font-semibold text-on-brand active:scale-95"
        >
          <MessageCircle size={15} aria-hidden="true" />
          Envoyer par WhatsApp
        </a>
        <a
          href={lien}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-10 items-center gap-1.5 rounded-full border border-ink/15 px-4 text-sm font-medium text-ink/70"
        >
          <ExternalLink size={15} aria-hidden="true" />
          Ouvrir le bon
        </a>
      </div>
    </div>
  );
}
