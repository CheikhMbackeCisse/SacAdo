"use client";

import { useState } from "react";
import { Download, Share2 } from "lucide-react";

// SacAdo — Actions facture (MODULE_FACTURES.md §3) : la facture n'est jamais
// stockée, la route /api/factures/[commandeId] la régénère à chaque appel à
// partir des données live (lib/factures/document.tsx). Ici on ne fait que
// déclencher le téléchargement, ou le partage du fichier lui-même (pas
// seulement un lien) via le partage natif du téléphone — WhatsApp apparaît
// comme cible si l'app est installée, comme le bouton "Partager" produit/kit
// (components/ui/share-button.tsx). Repli si le partage de fichier n'est pas
// supporté (desktop, anciens navigateurs) : ouvrir WhatsApp avec le lien en
// texte (sélection du contact dans WhatsApp même, wa.me sans numéro).
type Props = {
  commandeId: number;
  jeton: string;
  numero: string;
};

export function FactureActions({ commandeId, jeton, numero }: Props) {
  const [busy, setBusy] = useState<"telecharger" | "partager" | null>(null);

  const url = `/api/factures/${commandeId}?t=${encodeURIComponent(jeton)}`;

  const telecharger = () => {
    setBusy("telecharger");
    window.open(url, "_blank", "noopener");
    window.setTimeout(() => setBusy(null), 800);
  };

  const partager = async () => {
    setBusy("partager");
    try {
      const reponse = await fetch(url);
      if (!reponse.ok) throw new Error("telechargement_echoue");
      const blob = await reponse.blob();
      const fichier = new File([blob], `facture-${numero}.pdf`, { type: "application/pdf" });

      if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [fichier] })) {
        await navigator.share({ files: [fichier], title: `Facture SacAdo n°${numero}` });
        return;
      }
    } catch {
      // Partage annulé par l'utilisateur, ou fichiers non supportés -> repli texte.
    } finally {
      setBusy(null);
    }

    const lienAbsolu = typeof window !== "undefined" ? `${window.location.origin}${url}` : url;
    const message = `Voici ma facture SacAdo n°${numero} : ${lienAbsolu}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener");
  };

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={telecharger}
        disabled={busy !== null}
        className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-brand px-4 text-sm font-semibold text-on-brand transition-transform active:scale-95 disabled:opacity-60"
      >
        <Download size={15} aria-hidden="true" />
        Télécharger
      </button>
      <button
        type="button"
        onClick={partager}
        disabled={busy !== null}
        className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full border border-ink/15 px-4 text-sm font-semibold text-ink transition-transform active:scale-95 disabled:opacity-60"
      >
        <Share2 size={15} aria-hidden="true" />
        {busy === "partager" ? "Préparation…" : "Envoyer sur WhatsApp"}
      </button>
    </div>
  );
}
