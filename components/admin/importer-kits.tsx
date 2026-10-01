"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import type { ApercuImport } from "@/lib/admin/kits-import-actions";

// Import Excel du contenu des kits (PROMPT_ADMIN.md Lot 5) : on analyse
// d'abord (aperçu des différences), l'admin confirme, puis on écrit.
export function ImporterKits() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [ouvert, setOuvert] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [apercu, setApercu] = useState<ApercuImport | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [resume, setResume] = useState<string | null>(null);
  const [fichier, setFichier] = useState<File | null>(null);

  const reinitialiser = () => {
    setOuvert(false);
    setApercu(null);
    setErreur(null);
    setResume(null);
    setFichier(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const analyser = async (f: File) => {
    setFichier(f);
    setEnCours(true);
    setErreur(null);
    setResume(null);
    try {
      const form = new FormData();
      form.append("fichier", f);
      form.append("mode", "apercu");
      const res = await fetch("/admin/kits/import", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok || data.erreur) {
        setErreur(data.erreur ?? "Impossible d'analyser ce fichier.");
        setApercu(null);
      } else {
        setApercu(data as ApercuImport);
      }
    } catch {
      setErreur("Impossible d'analyser ce fichier.");
    } finally {
      setEnCours(false);
    }
  };

  const confirmer = async () => {
    if (!fichier) return;
    setEnCours(true);
    setErreur(null);
    try {
      const form = new FormData();
      form.append("fichier", fichier);
      form.append("mode", "appliquer");
      const res = await fetch("/admin/kits/import", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErreur(data.error ?? "Impossible d'appliquer cet import.");
      } else {
        setResume(data.resume ?? "Import appliqué.");
        setApercu(null);
        router.refresh();
      }
    } catch {
      setErreur("Impossible d'appliquer cet import.");
    } finally {
      setEnCours(false);
    }
  };

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="flex items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/70"
      >
        <Upload size={14} aria-hidden="true" />
        Importer un Excel
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Importer le contenu des kits</h2>
        <button type="button" onClick={reinitialiser} className="text-xs text-ink/50 hover:underline">
          Annuler
        </button>
      </div>

      {!apercu && !resume && (
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          disabled={enCours}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) analyser(f);
          }}
          className="text-sm"
        />
      )}

      {enCours && <p className="text-xs text-ink/50">Analyse en cours…</p>}
      {erreur && <p className="text-xs text-red-600">{erreur}</p>}
      {resume && <p className="text-xs font-medium text-brand">{resume}</p>}

      {apercu && (
        <div className="flex flex-col gap-3">
          {apercu.kits.length === 0 && apercu.kitsAbsentsDuFichier.length === 0 ? (
            <p className="text-xs text-ink/50">Aucune différence avec le fichier actuel.</p>
          ) : (
            <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto text-xs">
              {apercu.kits
                .filter(
                  (k) =>
                    k.nouveau ||
                    k.statutActuel !== k.statutImporte ||
                    k.itemsAjoutes.length > 0 ||
                    k.itemsModifies.length > 0 ||
                    k.itemsRetires.length > 0,
                )
                .map((k) => (
                  <li key={k.cle} className="rounded-xl border border-ink/10 p-2.5">
                    <p className="font-medium text-ink">
                      {k.nom} {k.nouveau && <span className="text-brand">(nouveau kit)</span>}
                      {k.produitsIntrouvables.length > 0 && (
                        <span className="ml-1 text-red-600">— ignoré : produit(s) introuvable(s)</span>
                      )}
                    </p>
                    {k.statutActuel !== k.statutImporte && (
                      <p className="text-ink/60">
                        Statut : {k.statutActuel ?? "—"} → {k.statutImporte}
                      </p>
                    )}
                    {k.itemsAjoutes.length > 0 && (
                      <p className="text-green-700">+ {k.itemsAjoutes.map((i) => i.produitNom).join(", ")}</p>
                    )}
                    {k.itemsModifies.length > 0 && (
                      <p className="text-amber-700">
                        ~ {k.itemsModifies.map((i) => i.produitNom).join(", ")}
                      </p>
                    )}
                    {k.itemsRetires.length > 0 && (
                      <p className="text-red-600">− {k.itemsRetires.map((i) => i.produitNom).join(", ")}</p>
                    )}
                    {k.produitsIntrouvables.length > 0 && (
                      <p className="text-red-600">Introuvables : {k.produitsIntrouvables.join(", ")}</p>
                    )}
                  </li>
                ))}
            </ul>
          )}

          {apercu.kitsAbsentsDuFichier.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
              Ces kits ne sont pas dans le fichier et seront <strong>masqués</strong> (jamais supprimés) :{" "}
              {apercu.kitsAbsentsDuFichier.map((k) => k.nom).join(", ")}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              disabled={enCours}
              onClick={confirmer}
              className="rounded-full bg-brand px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
            >
              Confirmer l&rsquo;import
            </button>
            <button type="button" onClick={reinitialiser} className="rounded-full border border-ink/15 px-4 py-2 text-xs text-ink/70">
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
