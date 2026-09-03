"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";

// Bouton « Partager » (CORRECTIONS_V8 §5) : ouvre le partage natif du téléphone
// (Web Share API -> WhatsApp, SMS…) sur un lien direct vers ce produit / ce kit.
// Repli : copie le lien dans le presse-papier.
export function ShareButton({
  path,
  title,
  className,
  size = 20,
}: {
  path: string;
  title: string;
  className?: string;
  size?: number;
}) {
  const [copie, setCopie] = useState(false);

  const partager = async () => {
    const url = typeof window !== "undefined" ? `${window.location.origin}${path}` : path;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // annulé par l'utilisateur, ou partage indisponible -> on tente la copie
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopie(true);
      window.setTimeout(() => setCopie(false), 2000);
    } catch {
      window.prompt("Copiez le lien :", url);
    }
  };

  return (
    <button
      type="button"
      onClick={partager}
      aria-label={copie ? "Lien copié" : "Partager"}
      className={
        className ??
        "flex size-9 items-center justify-center rounded-full bg-surface/90 text-ink shadow-sm backdrop-blur transition-transform active:scale-90"
      }
    >
      {copie ? (
        <Check size={size} className="text-success" aria-hidden="true" />
      ) : (
        <Share2 size={size} aria-hidden="true" />
      )}
    </button>
  );
}
