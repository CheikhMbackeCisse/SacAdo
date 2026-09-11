"use client";

import { Bell, BellOff, BellRing } from "lucide-react";
import { usePushClient } from "@/lib/pwa/push-client";

// Réglage « Activer les notifications » côté client, rendu comme une ligne de la
// section Paramètres (titre + contrôle). Le bon moment pour DEMANDER la
// permission (après la première commande) est géré ailleurs (B3) ; ici c'est un
// simple interrupteur pour activer / couper à la main.

export function ActiverPushClient() {
  const { etat, activer, desactiver } = usePushClient();

  // Push impossible sur cet environnement : on n'affiche même pas la ligne.
  if (etat === "chargement" || etat === "non_supporte" || etat === "indisponible") {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 px-4 py-3">
      <span className="text-sm text-ink">Notifications</span>

      {etat === "sans_identite" ? (
        <p className="text-xs text-ink/50">
          Disponible après ta première commande depuis cet appareil.
        </p>
      ) : etat === "refuse" ? (
        <p className="flex items-center gap-2 text-xs text-ink/55">
          <BellOff size={14} aria-hidden="true" />
          Bloquées par le navigateur. Autorise-les dans les réglages du site pour suivre tes
          commandes.
        </p>
      ) : (
        <ToggleBouton
          actif={etat === "actif"}
          occupe={etat === "occupe"}
          onClick={etat === "actif" ? desactiver : activer}
        />
      )}
    </div>
  );
}

function ToggleBouton({
  actif,
  occupe,
  onClick,
}: {
  actif: boolean;
  occupe: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={occupe}
      className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors disabled:opacity-50 ${
        actif
          ? "border-success/30 bg-success/[0.06]"
          : "border-ink/10 bg-elevated hover:border-brand/40"
      }`}
    >
      {actif ? (
        <BellRing size={16} className="shrink-0 text-success" aria-hidden="true" />
      ) : (
        <Bell size={16} className="shrink-0 text-brand" aria-hidden="true" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-ink">
          {actif ? "Notifications activées" : "Activer les notifications"}
        </span>
        <span className="block text-xs text-ink/50">
          {occupe
            ? "…"
            : actif
              ? "Tu es prévenu sur cet appareil quand ta commande avance. Touche pour couper."
              : "Être prévenu quand ta commande part et arrive, même l'app fermée."}
        </span>
      </span>
    </button>
  );
}
