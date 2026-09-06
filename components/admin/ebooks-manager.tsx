"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, FileText, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { CYCLES } from "@/lib/cycles";
import { ChampSelect } from "@/components/ui/champ-select";
import {
  associerClasse,
  creerEbook,
  dissocierClasse,
  remplacerFichierEbook,
  renommerEbook,
  supprimerEbook,
  type EbookAvecClasses,
} from "@/lib/admin/ebooks-actions";
import type { Cycle } from "@/lib/supabase/types";

const LABELS_CYCLE: Record<Cycle, string> = {
  prescolaire: "Préscolaire",
  elementaire: "Élémentaire",
  college: "Collège",
  lycee: "Lycée",
};

const CHAMP = "min-h-11 rounded-lg border border-ink/15 px-3 text-sm";

function formatTaille(octets: number | null): string {
  if (!octets) return "taille inconnue";
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`;
  return `${(octets / 1024 / 1024).toFixed(1)} Mo`;
}

function classeLabel(cycle: string, niveau: string): string {
  return `${LABELS_CYCLE[cycle as Cycle] ?? cycle} · ${niveau}`;
}

export function EbooksManager({ ebooks }: { ebooks: EbookAvecClasses[] }) {
  const router = useRouter();

  // Classes déjà rattachées à un ebook (pour la synthèse de couverture).
  const classesCouvertes = useMemo(() => {
    const set = new Set<string>();
    for (const e of ebooks) for (const c of e.classes) set.add(`${c.cycle}|${c.niveau}`);
    return set;
  }, [ebooks]);

  return (
    <div className="flex flex-col gap-5">
      <AjouterEbook onDone={() => router.refresh()} />

      {ebooks.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-ink/15 bg-white px-4 py-8 text-center text-sm text-ink/50">
          Aucun ebook pour l&apos;instant.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {ebooks.map((ebook) => (
            <li key={ebook.id}>
              <CarteEbook ebook={ebook} onDone={() => router.refresh()} />
            </li>
          ))}
        </ul>
      )}

      <CouvertureClasses classesCouvertes={classesCouvertes} />
    </div>
  );
}

function AjouterEbook({ onDone }: { onDone: () => void }) {
  const [titre, setTitre] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const file = fileRef.current?.files?.[0];
    if (!titre.trim()) return setError("Donne un titre à l'ebook.");
    if (!file) return setError("Choisis un fichier PDF.");

    const formData = new FormData();
    formData.set("titre", titre.trim());
    formData.set("fichier", file);

    setSubmitting(true);
    const result = await creerEbook(formData);
    setSubmitting(false);
    if (!result.ok) return setError(result.error);

    setTitre("");
    if (fileRef.current) fileRef.current.value = "";
    onDone();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-white p-4"
    >
      <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
        <Plus size={15} aria-hidden="true" />
        Ajouter un ebook
      </span>

      <label className="flex flex-col gap-1 text-xs">
        <span className="text-ink/60">Titre</span>
        <input
          value={titre}
          onChange={(event) => setTitre(event.target.value)}
          placeholder="Guide de réussite CE2"
          maxLength={120}
          className={CHAMP}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs">
        <span className="text-ink/60">Fichier PDF</span>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          className="text-sm text-ink/70 file:mr-3 file:min-h-11 file:rounded-lg file:border file:border-ink/15 file:bg-elevated file:px-3 file:text-sm file:text-ink"
        />
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-full bg-brand min-h-11 px-4 text-sm font-semibold text-surface active:scale-95 disabled:opacity-50"
      >
        {submitting ? "Envoi…" : "Créer l'ebook"}
      </button>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  );
}

function CarteEbook({ ebook, onDone }: { ebook: EbookAvecClasses; onDone: () => void }) {
  const [titre, setTitre] = useState(ebook.titre);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const lancer = async (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setError(null);
    setBusy(true);
    const result = await fn();
    setBusy(false);
    if (!result.ok) return setError(result.error);
    onDone();
  };

  const enregistrerTitre = () => {
    if (titre.trim() && titre.trim() !== ebook.titre) {
      void lancer(() => renommerEbook(ebook.id, titre));
    }
  };

  const remplacer = () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.set("fichier", file);
    void lancer(() => remplacerFichierEbook(ebook.id, formData)).then(() => {
      if (fileRef.current) fileRef.current.value = "";
    });
  };

  const supprimer = () => {
    if (confirm(`Supprimer l'ebook « ${ebook.titre} » ? Les classes associées n'auront plus d'ebook.`)) {
      void lancer(() => supprimerEbook(ebook.id));
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-white p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
          <BookOpen size={17} aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <input
            value={titre}
            onChange={(event) => setTitre(event.target.value)}
            onBlur={enregistrerTitre}
            maxLength={120}
            aria-label="Titre de l'ebook"
            className="w-full rounded-md border border-transparent px-1 py-0.5 text-sm font-medium text-ink hover:border-ink/15 focus:border-brand focus:outline-none"
          />
          <span className="flex items-center gap-1.5 px-1 text-xs text-ink/45">
            <FileText size={12} aria-hidden="true" />
            PDF · {formatTaille(ebook.taille_octets)}
          </span>
        </div>
        <button
          type="button"
          onClick={supprimer}
          disabled={busy}
          aria-label="Supprimer l'ebook"
          className="shrink-0 rounded-lg p-1.5 text-ink/40 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>

      <ClassesEbook classes={ebook.classes} ebookId={ebook.id} onDone={onDone} />

      <div className="flex flex-wrap items-center gap-2 border-t border-ink/10 pt-3">
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={remplacer}
          className="hidden"
          id={`replace-${ebook.id}`}
        />
        <label
          htmlFor={`replace-${ebook.id}`}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/70 hover:border-brand hover:text-brand"
        >
          <RefreshCw size={13} aria-hidden="true" />
          {busy ? "…" : "Remplacer le fichier"}
        </label>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function ClassesEbook({
  classes,
  ebookId,
  onDone,
}: {
  classes: EbookAvecClasses["classes"];
  ebookId: number;
  onDone: () => void;
}) {
  const [cycle, setCycle] = useState<Cycle | "">("");
  const [niveau, setNiveau] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const niveaux = cycle ? (CYCLES.find((c) => c.value === cycle)?.classes ?? []) : [];

  const ajouter = async () => {
    if (cycle === "" || !niveau) return;
    setError(null);
    setBusy(true);
    const result = await associerClasse(ebookId, cycle, niveau);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setNiveau("");
    onDone();
  };

  const retirer = async (id: number) => {
    setBusy(true);
    await dissocierClasse(id);
    setBusy(false);
    onDone();
  };

  return (
    <div className="flex flex-col gap-2">
      {classes.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {classes.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1 rounded-full bg-decorative/15 py-1 pl-2.5 pr-1 text-xs text-ink/75"
            >
              {classeLabel(c.cycle, c.niveau)}
              <button
                type="button"
                onClick={() => retirer(c.id)}
                disabled={busy}
                aria-label={`Retirer ${classeLabel(c.cycle, c.niveau)}`}
                className="rounded-full p-0.5 text-ink/40 hover:bg-ink/10 hover:text-ink disabled:opacity-50"
              >
                <X size={12} aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-ink/45">Aucune classe associée — cet ebook n&apos;est offert à personne.</p>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <ChampSelect
          ariaLabel="Cycle"
          placeholder="Cycle…"
          className={CHAMP}
          wrapperClassName="w-36"
          value={cycle}
          onChange={(v) => {
            setCycle(v as Cycle | "");
            setNiveau("");
          }}
          options={CYCLES.map((c) => ({ value: c.value, label: c.label }))}
        />
        <ChampSelect
          ariaLabel="Niveau"
          placeholder="Classe…"
          className={CHAMP}
          wrapperClassName="w-40"
          value={niveau}
          onChange={setNiveau}
          disabled={cycle === ""}
          options={niveaux.map((n) => ({ value: n, label: n }))}
        />
        <button
          type="button"
          onClick={ajouter}
          disabled={busy || cycle === "" || !niveau}
          className="inline-flex items-center gap-1 rounded-full border border-ink/15 px-3 py-2 text-xs font-medium text-ink/70 hover:border-brand hover:text-brand disabled:opacity-40"
        >
          <Plus size={13} aria-hidden="true" />
          Associer
        </button>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function CouvertureClasses({ classesCouvertes }: { classesCouvertes: Set<string> }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-white p-4">
      <span className="text-sm font-semibold text-ink">Couverture par classe</span>
      <div className="flex flex-col gap-3">
        {CYCLES.map((c) => {
          const manquantes = c.classes.filter((n) => !classesCouvertes.has(`${c.value}|${n}`));
          return (
            <div key={c.value} className="flex flex-col gap-1">
              <span className="text-xs font-medium text-ink/70">
                {LABELS_CYCLE[c.value]}{" "}
                <span className="font-normal text-ink/45">
                  {c.classes.length - manquantes.length}/{c.classes.length} couvertes
                </span>
              </span>
              {manquantes.length > 0 && (
                <span className="text-xs text-ink/50">Sans ebook : {manquantes.join(", ")}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
