"use client";

import { useEffect, useState } from "react";
import { Bell, Share, SquarePlus } from "lucide-react";
import { usePushClient } from "@/lib/pwa/push-client";
import { useInstallState } from "@/lib/pwa/install-prompt";
import {
  estCommandeFraiche,
  invitePushEpuisee,
  reporterInvitePush,
  cloreInvitePush,
} from "@/lib/local/push-invite";

// Invite « Tu veux qu'on te prévienne quand ta commande part ? » sur l'écran de
// confirmation, juste après la 1re commande validée (TACHE_notifications_client.md
// §1). Sur iPhone non installé, remplacée par l'invitation à installer — le push
// n'y fonctionne pas tant que l'app n'est pas sur l'écran d'accueil.
export function PushInvite({ commandeId }: { commandeId: number }) {
  const [eligible, setEligible] = useState(false);
  const [ios, setIos] = useState(false);
  const [ferme, setFerme] = useState(false);
  const { installed } = useInstallState();
  const { etat, activer } = usePushClient();

  useEffect(() => {
    // setTimeout : évite un setState synchrone dans le corps de l'effet.
    const t = setTimeout(() => {
      setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
      if (estCommandeFraiche(commandeId) && !invitePushEpuisee()) setEligible(true);
    }, 0);
    return () => clearTimeout(t);
  }, [commandeId]);

  const iosNonInstalle = ios && !installed;

  // Push déjà actif ou déjà refusé par le navigateur : rien à proposer, jamais
  // reproposer. "chargement" : on attend avant d'afficher pour éviter un flash.
  const pushHorsSujet = !iosNonInstalle && etat !== "inactif";

  if (!eligible || ferme || pushHorsSujet) return null;

  const plusTard = () => {
    reporterInvitePush();
    setFerme(true);
  };

  const accepter = async () => {
    if (!iosNonInstalle) await activer();
    cloreInvitePush();
    setFerme(true);
  };

  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-brand/25 bg-brand/5 p-3.5">
      {iosNonInstalle ? (
        <>
          <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
            <Bell size={15} className="shrink-0 text-brand" aria-hidden="true" />
            Suis ta commande sans ouvrir le navigateur
          </p>
          <p className="text-xs text-ink/65">
            Installe SacAdo sur ton écran d&apos;accueil pour être prévenu quand elle part et
            arrive.
          </p>
          <ol className="flex flex-col gap-1.5 text-xs text-ink/75">
            <li className="flex items-center gap-1.5">
              <Share size={13} className="shrink-0 text-brand" aria-hidden="true" />
              Touche le bouton Partager de Safari
            </li>
            <li className="flex items-center gap-1.5">
              <SquarePlus size={13} className="shrink-0 text-brand" aria-hidden="true" />
              «&nbsp;Sur l&apos;écran d&apos;accueil&nbsp;»
            </li>
          </ol>
        </>
      ) : (
        <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
          <Bell size={15} className="shrink-0 text-brand" aria-hidden="true" />
          Tu veux qu&apos;on te prévienne quand ta commande part ?
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={accepter}
          className="h-9 flex-1 rounded-full bg-brand text-xs font-semibold text-on-brand active:scale-95"
        >
          {iosNonInstalle ? "J'ai compris" : "Oui"}
        </button>
        <button
          type="button"
          onClick={plusTard}
          className="h-9 flex-1 rounded-full border border-ink/15 text-xs font-medium text-ink/70"
        >
          Plus tard
        </button>
      </div>
    </div>
  );
}
