"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, QrCode } from "lucide-react";
import { creerLienSuivi, genererQrLien } from "@/lib/admin/trafic-actions";

// Création d'un lien suivi + QR code (PROMPT_ADMIN_V2 Lot 3) : le code sert à
// la fois d'identifiant et d'utm_campaign, pour ne demander qu'un seul champ
// à l'admin en plus de la source.
export function CreerLienForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [source, setSource] = useState("");
  const [libelle, setLibelle] = useState("");
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErreur(null);
    const res = await creerLienSuivi({ code, utmSource: source, libelle: libelle || null });
    setSaving(false);
    if (!res.ok) {
      setErreur(res.error);
      return;
    }
    setCode("");
    setSource("");
    setLibelle("");
    router.refresh();
  };

  return (
    <form onSubmit={soumettre} className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-white p-4">
      <p className="text-sm font-semibold text-ink">Créer un lien suivi</p>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Code (ex. affiche-lycee-delafosse)"
        className="rounded-lg border border-ink/15 px-3 py-2 text-sm"
        required
      />
      <input
        value={source}
        onChange={(e) => setSource(e.target.value)}
        placeholder="Source (ex. affiche, whatsapp, flyer…)"
        className="rounded-lg border border-ink/15 px-3 py-2 text-sm"
        required
      />
      <input
        value={libelle}
        onChange={(e) => setLibelle(e.target.value)}
        placeholder="Nom à afficher (optionnel)"
        className="rounded-lg border border-ink/15 px-3 py-2 text-sm"
      />
      {erreur && <p className="text-xs text-red-600">{erreur}</p>}
      <button
        type="submit"
        disabled={saving}
        className="flex min-h-9 items-center justify-center gap-1.5 rounded-full bg-brand px-3 text-sm font-semibold text-on-brand disabled:opacity-50"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : "Créer"}
      </button>
    </form>
  );
}

export function BoutonQrLien({ utmSource, utmCampaign, code }: { utmSource: string; utmCampaign: string; code: string }) {
  const [qr, setQr] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);

  const afficher = async () => {
    if (qr) {
      setQr(null);
      return;
    }
    setChargement(true);
    const dataUrl = await genererQrLien(utmSource, utmCampaign);
    setChargement(false);
    setQr(dataUrl);
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={afficher}
        className="flex items-center gap-1.5 text-xs font-medium text-brand"
      >
        <QrCode size={14} aria-hidden="true" />
        {chargement ? "Génération…" : qr ? "Masquer le QR" : "Voir le QR code"}
      </button>
      {qr && (
        <div className="flex flex-col items-start gap-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt={`QR code pour ${code}`} width={160} height={160} className="rounded-lg border border-ink/10" />
          <a href={qr} download={`qr-${code}.png`} className="text-xs font-medium text-ink/60 underline">
            Télécharger en PNG
          </a>
        </div>
      )}
    </div>
  );
}
