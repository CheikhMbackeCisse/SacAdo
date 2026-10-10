"use client";

import { useMemo, useState } from "react";
import { Download, Share2 } from "lucide-react";
import { formatPrice } from "@/lib/format";
import { FournisseurCarteAchat } from "@/components/admin/fournisseur-carte-achat";
import type { ArticleAchat, GroupeFournisseur } from "@/lib/admin/achats-actions";

type LigneAgregee = {
  cle: string;
  produitNom: string;
  varianteLabel: string | null;
  produitPhoto: string | null;
  kitNom: string | null;
  vendeurNom: string;
  prixUnitaire: number;
  prixAchatUnitaire: number | null;
  quantiteTotale: number;
  detail: { commandeId: number; clientNom: string; quantite: number }[];
};

function agreger(articles: ArticleAchat[]): LigneAgregee[] {
  const map = new Map<string, LigneAgregee>();
  for (const a of articles) {
    const cle = `${a.produitId}-${a.varianteId ?? "0"}`;
    let ligne = map.get(cle);
    if (!ligne) {
      ligne = {
        cle,
        produitNom: a.produitNom,
        varianteLabel: a.varianteLabel,
        produitPhoto: a.produitPhoto,
        kitNom: a.kitNom,
        vendeurNom: a.vendeurNom,
        prixUnitaire: a.prixUnitaire,
        prixAchatUnitaire: a.prixAchatUnitaire,
        quantiteTotale: 0,
        detail: [],
      };
      map.set(cle, ligne);
    }
    ligne.quantiteTotale += a.quantite;
    ligne.detail.push({ commandeId: a.commandeId, clientNom: a.clientNom, quantite: a.quantite });
  }
  return [...map.values()].sort((a, b) => a.produitNom.localeCompare(b.produitNom));
}

// WhatsApp transforme parfois les .webp en stickers : on repasse chaque photo
// en JPEG avant de la proposer au téléchargement/partage (Lot 2d).
async function versJpeg(url: string): Promise<Blob | null> {
  try {
    const reponse = await fetch(url);
    const blob = await reponse.blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return blob;
    ctx.drawImage(bitmap, 0, 0);
    return await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.9));
  } catch {
    return null;
  }
}

function nomFichier(ligne: LigneAgregee): string {
  const base = `${ligne.quantiteTotale}x-${ligne.produitNom}`.replace(/[^a-zA-Z0-9-]+/g, "-");
  return `${base}.jpg`;
}

function BoutonsPhotos({ lignes }: { lignes: LigneAgregee[] }) {
  const [enCours, setEnCours] = useState(false);
  const avecPhoto = lignes.filter((l) => l.produitPhoto);
  const peutPartager = typeof navigator !== "undefined" && "canShare" in navigator;

  const telecharger = async () => {
    setEnCours(true);
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      for (const ligne of avecPhoto) {
        const jpeg = await versJpeg(ligne.produitPhoto!);
        if (jpeg) zip.file(nomFichier(ligne), jpeg);
      }
      const contenu = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(contenu);
      const a = document.createElement("a");
      a.href = url;
      a.download = "photos-commande.zip";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setEnCours(false);
    }
  };

  const partager = async () => {
    setEnCours(true);
    try {
      const fichiers: File[] = [];
      for (const ligne of avecPhoto) {
        const jpeg = await versJpeg(ligne.produitPhoto!);
        if (jpeg) fichiers.push(new File([jpeg], nomFichier(ligne), { type: "image/jpeg" }));
      }
      if (fichiers.length === 0) return;
      if (navigator.canShare?.({ files: fichiers })) {
        await navigator.share({ files: fichiers });
      }
    } catch {
      // Partage annulé par l'utilisateur ou indisponible : pas bloquant.
    } finally {
      setEnCours(false);
    }
  };

  if (avecPhoto.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {peutPartager && (
        <button
          type="button"
          onClick={partager}
          disabled={enCours}
          className="flex min-h-9 items-center gap-1.5 rounded-full border border-ink/15 px-3 text-xs font-medium text-ink/70 disabled:opacity-50 sm:hidden"
        >
          <Share2 size={13} aria-hidden="true" />
          Envoyer les photos
        </button>
      )}
      <button
        type="button"
        onClick={telecharger}
        disabled={enCours}
        className="flex min-h-9 items-center gap-1.5 rounded-full border border-ink/15 px-3 text-xs font-medium text-ink/70 disabled:opacity-50"
      >
        <Download size={13} aria-hidden="true" />
        Télécharger les photos (.zip)
      </button>
    </div>
  );
}

export function ProduitsCommandeVue({
  tousLesArticles,
  fournisseurs,
  stockSacAdo,
}: {
  tousLesArticles: ArticleAchat[];
  fournisseurs: GroupeFournisseur[];
  stockSacAdo: ArticleAchat[];
}) {
  const [onglet, setOnglet] = useState<"produits" | "fournisseurs">("produits");
  const lignes = useMemo(() => agreger(tousLesArticles), [tousLesArticles]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 border-b border-ink/10">
        {([
          { value: "produits" as const, label: "Produits" },
          { value: "fournisseurs" as const, label: "Fournisseurs" },
        ]).map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setOnglet(t.value)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${
              onglet === t.value ? "border-brand text-brand" : "border-transparent text-ink/50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {onglet === "produits" ? (
        <div className="flex flex-col gap-3">
          <BoutonsPhotos lignes={lignes} />
          <div className="overflow-x-auto rounded-2xl border border-ink/10 bg-white">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-ink/10 text-left text-xs text-ink/50">
                  <th className="px-3 py-2 font-medium">Article</th>
                  <th className="px-3 py-2 font-medium">Qté</th>
                  <th className="px-3 py-2 font-medium">Prix vente</th>
                  <th className="px-3 py-2 font-medium">Prix achat</th>
                  <th className="px-3 py-2 font-medium">Fournisseur</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((ligne) => (
                  <LigneProduit key={ligne.cle} ligne={ligne} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {fournisseurs.length === 0 && stockSacAdo.length === 0 && (
            <p className="rounded-2xl border border-ink/10 bg-white px-4 py-8 text-center text-sm text-ink/50">
              Aucun article à commander.
            </p>
          )}
          {fournisseurs.map((groupe) => (
            <FournisseurCarteAchat key={groupe.vendeurId} groupe={groupe} />
          ))}
          {stockSacAdo.length > 0 && (
            <div className="rounded-2xl border border-ink/10 bg-ink/[0.02] p-4">
              <p className="mb-2 text-sm font-semibold text-ink">Stock SacAdo, rien à commander</p>
              <ul className="flex flex-col gap-1 text-xs text-ink/60">
                {stockSacAdo.map((a) => (
                  <li key={a.commandeItemId}>
                    {a.quantite} x {a.produitNom}
                    {a.varianteLabel ? ` (${a.varianteLabel})` : ""} — commande #{a.commandeId}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LigneProduit({ ligne }: { ligne: LigneAgregee }) {
  const [ouvert, setOuvert] = useState(false);
  const multi = ligne.detail.length > 1;

  return (
    <>
      <tr className="border-b border-ink/5 last:border-0">
        <td className="px-3 py-2">
          <div className="flex items-center gap-2">
            {ligne.produitPhoto && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={ligne.produitPhoto} alt="" className="size-9 shrink-0 rounded-md border border-ink/10 object-cover" />
            )}
            <div className="min-w-0">
              {ligne.kitNom && <p className="text-[10px] font-medium text-brand/70">Kit {ligne.kitNom}</p>}
              <p className="truncate font-medium text-ink">{ligne.produitNom}</p>
              {ligne.varianteLabel && <p className="text-xs text-ink/50">{ligne.varianteLabel}</p>}
            </div>
          </div>
        </td>
        <td className="px-3 py-2 text-ink">
          {ligne.quantiteTotale}
          {multi && (
            <button type="button" onClick={() => setOuvert((o) => !o)} className="ml-1.5 text-xs text-brand underline">
              détail
            </button>
          )}
        </td>
        <td className="px-3 py-2 text-ink/70">{formatPrice(ligne.prixUnitaire)}</td>
        <td className="px-3 py-2 text-ink/70">{ligne.prixAchatUnitaire != null ? formatPrice(ligne.prixAchatUnitaire) : "—"}</td>
        <td className="px-3 py-2 text-ink/70">{ligne.vendeurNom}</td>
      </tr>
      {ouvert && (
        <tr className="border-b border-ink/5 bg-ink/[0.02] last:border-0">
          <td colSpan={5} className="px-3 py-2">
            <ul className="flex flex-col gap-1 text-xs text-ink/60">
              {ligne.detail.map((d, i) => (
                <li key={i}>
                  #{d.commandeId} {d.clientNom} — {d.quantite}
                </li>
              ))}
            </ul>
          </td>
        </tr>
      )}
    </>
  );
}
