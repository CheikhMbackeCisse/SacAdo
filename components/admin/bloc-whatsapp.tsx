"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, MessageCircle, Send, TriangleAlert } from "lucide-react";
import {
  confirmerEnvoiWhatsApp,
  type BlocWhatsApp,
  type BoutonWhatsApp,
} from "@/lib/admin/whatsapp-actions";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function BlocWhatsAppFiche({ commandeId, bloc }: { commandeId: number; bloc: BlocWhatsApp }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-white p-4 text-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 font-semibold text-ink">
          <MessageCircle size={16} className="text-brand" aria-hidden="true" />
          WhatsApp
        </h2>
        {bloc.telephoneAffiche && (
          <span className="text-xs text-ink/55">
            {bloc.telephoneAffiche}
            {bloc.numeroDouteux && " — préfixe inhabituel"}
          </span>
        )}
      </div>

      {!bloc.numeroValide ? (
        <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-xs text-ink/75">
          <TriangleAlert size={14} className="mt-0.5 shrink-0 text-red-600" aria-hidden="true" />
          Numéro du client inexploitable — impossible d&apos;ouvrir WhatsApp. Corrige-le avec le
          client par un autre moyen.
        </p>
      ) : (
        <>
          {bloc.numeroDouteux && (
            <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-xs text-ink/75">
              <TriangleAlert size={14} className="mt-0.5 shrink-0 text-red-600" aria-hidden="true" />
              Ce numéro ne ressemble pas à un mobile sénégalais habituel. Vérifie avant d&apos;envoyer.
            </p>
          )}

          <ul className="flex flex-col gap-2">
            {bloc.boutons.map((b) => (
              <LigneBouton key={b.code} commandeId={commandeId} bouton={b} />
            ))}
          </ul>

          {bloc.lienMessageLibre && (
            <a
              href={bloc.lienMessageLibre}
              target="_blank"
              rel="noopener noreferrer"
              className="w-fit rounded-full border border-ink/15 px-3.5 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/5"
            >
              Message libre
            </a>
          )}

          <p className="text-[11px] text-ink/40">
            Le message part du compte WhatsApp connecté sur cet appareil : garde la session du{" "}
            {bloc.numeroSacado} ouverte.
          </p>
        </>
      )}

      {bloc.historique.length > 0 && (
        <div className="border-t border-ink/10 pt-2.5">
          <p className="mb-1.5 text-xs font-medium text-ink/50">Déjà envoyé</p>
          <ul className="flex flex-col gap-1.5">
            {bloc.historique.map((e) => (
              <li key={e.id} className="text-xs text-ink/60">
                <span className="text-ink/40">{formatDate(e.cree_le)}</span> —{" "}
                {e.code_modele ?? "message libre"}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function LigneBouton({ commandeId, bouton }: { commandeId: number; bouton: BoutonWhatsApp }) {
  const router = useRouter();
  const [apercu, setApercu] = useState(false);
  const [demandeConfirm, setDemandeConfirm] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const ouvrir = () => {
    window.open(bouton.lien, "_blank", "noopener,noreferrer");
    setDemandeConfirm(true);
  };

  const confirmer = async (envoye: boolean) => {
    if (!envoye) {
      setDemandeConfirm(false);
      return;
    }
    setEnCours(true);
    setErreur(null);
    const res = await confirmerEnvoiWhatsApp({
      commandeId,
      code: bouton.code,
      contenu: bouton.contenu,
    });
    setEnCours(false);
    if (!res.ok) {
      setErreur(res.error);
      return;
    }
    setDemandeConfirm(false);
    router.refresh();
  };

  return (
    <li className="rounded-xl border border-ink/10">
      <div className="flex items-center gap-2 p-2">
        <button
          type="button"
          onClick={ouvrir}
          title={bouton.contenu}
          className={`flex min-h-9 flex-1 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold ${
            bouton.correspondStatut
              ? "bg-brand text-surface"
              : "border border-ink/15 text-ink/75 hover:bg-ink/5"
          }`}
        >
          <Send size={13} aria-hidden="true" />
          {bouton.libelle}
        </button>
        <button
          type="button"
          onClick={() => setApercu((v) => !v)}
          aria-label="Aperçu du message"
          className="rounded-lg p-1.5 text-ink/40 hover:bg-ink/5"
        >
          <ChevronDown size={15} aria-hidden="true" />
        </button>
      </div>

      {apercu && (
        <p className="whitespace-pre-wrap border-t border-ink/10 px-3 py-2 text-xs text-ink/60">
          {bouton.contenu}
        </p>
      )}

      {demandeConfirm && (
        <div className="flex items-center gap-2 border-t border-ink/10 px-3 py-2">
          <span className="text-xs text-ink/60">Message envoyé ?</span>
          <button
            type="button"
            disabled={enCours}
            onClick={() => confirmer(true)}
            className="rounded-full bg-brand px-3 py-1 text-xs font-semibold text-surface disabled:opacity-50"
          >
            Oui
          </button>
          <button
            type="button"
            disabled={enCours}
            onClick={() => confirmer(false)}
            className="rounded-full border border-ink/15 px-3 py-1 text-xs font-medium text-ink/60"
          >
            Pas encore
          </button>
        </div>
      )}

      {erreur && <p className="px-3 pb-2 text-xs text-red-600">{erreur}</p>}
    </li>
  );
}
