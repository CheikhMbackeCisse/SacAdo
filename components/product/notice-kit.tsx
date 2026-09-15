"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { ProductImage } from "@/components/ui/product-image";
import { useIdentite } from "@/lib/local/identite";
import { getDocumentsClient, getLienDocument } from "@/lib/documents/actions";
import type { DocumentApercu } from "@/lib/supabase/types";

// TACHE_documents_telechargeables.md, lot 4 — bloc notice sur la fiche produit
// d'un kit. Tant que le kit n'est pas acheté (commande honorée), seul l'aperçu
// public est visible : photo du montage, titre + pages, ce qu'on apprend,
// matériel nécessaire (§5). Le schéma de câblage, le tableau des broches et le
// code restent dans le PDF, jamais ici. `identite` (téléphone + jeton, posée
// après une première commande) sert à savoir si CE visiteur a déjà le droit —
// sans elle, le bouton de téléchargement reste caché (pas de faux espoir).
export function NoticeKit({ documents }: { documents: DocumentApercu[] }) {
  const { identite } = useIdentite();
  const [debloques, setDebloques] = useState<Set<number>>(new Set());
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const telephone = identite?.telephone;
    const jeton = identite?.jeton;
    if (!telephone || !jeton) return;
    let annule = false;
    getDocumentsClient(telephone, jeton).then((liste) => {
      if (!annule) setDebloques(new Set(liste.map((d) => d.id)));
    });
    return () => {
      annule = true;
    };
  }, [identite?.telephone, identite?.jeton]);

  const telecharger = async (documentId: number) => {
    const telephone = identite?.telephone;
    const jeton = identite?.jeton;
    if (!telephone || !jeton) return;
    setBusyId(documentId);
    setError(null);
    const result = await getLienDocument(documentId, telephone, jeton);
    setBusyId(null);
    if (!result.ok) return setError(result.error);
    window.open(result.url, "_blank", "noopener");
  };

  if (documents.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {documents.map((doc) => {
        const debloque = debloques.has(doc.id);
        return (
          <div key={doc.id} className="flex flex-col gap-2 rounded-lg bg-ink/5 px-3 py-2.5">
            <div className="flex items-start gap-2.5">
              {doc.apercu_url && (
                <span className="relative size-14 shrink-0 overflow-hidden rounded-md bg-ink/10">
                  <ProductImage src={doc.apercu_url} alt={doc.titre} className="h-full w-full" />
                </span>
              )}
              <div className="flex min-w-0 flex-col gap-0.5 pt-0.5">
                <span className="text-xs font-medium text-ink">{doc.titre}</span>
                {doc.nombre_pages != null && (
                  <span className="text-[11px] text-ink/45">{doc.nombre_pages} pages</span>
                )}
              </div>
            </div>

            {doc.apercu_texte && (
              <p className="text-[11px] leading-relaxed text-ink/60">{doc.apercu_texte}</p>
            )}
            {doc.materiel_supplementaire && (
              <p className="text-[11px] leading-relaxed text-ink/50">
                Matériel nécessaire en plus du kit : {doc.materiel_supplementaire}
              </p>
            )}

            <p className="text-[11px] leading-relaxed text-ink/50">
              Verrouillé avant achat : schéma de câblage, tableau des broches, code commenté.
              Le code fourni est un point de départ, pas une solution à recopier telle quelle.
            </p>

            {debloque ? (
              <button
                type="button"
                onClick={() => telecharger(doc.id)}
                disabled={busyId === doc.id}
                className="inline-flex w-fit items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-on-brand disabled:opacity-60"
              >
                <Download size={13} aria-hidden="true" />
                {busyId === doc.id ? "Préparation…" : "Télécharger la notice"}
              </button>
            ) : (
              <span className="text-[11px] font-medium text-brand">
                La notice complète est incluse avec le kit.
              </span>
            )}
          </div>
        );
      })}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
