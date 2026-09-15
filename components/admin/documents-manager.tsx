"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, FileText, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { ChampSelect } from "@/components/ui/champ-select";
import {
  associerProduit,
  basculerActifDocument,
  creerDocument,
  dissocierProduit,
  getStatsDocument,
  modifierDocument,
  remplacerFichierDocument,
  supprimerDocument,
  type DocumentAvecProduits,
  type DocumentInput,
  type ProduitLie,
  type StatsDocument,
} from "@/lib/admin/documents-actions";

const CHAMP = "min-h-11 rounded-lg border border-ink/15 px-3 text-sm";
const ZONE = "rounded-lg border border-ink/15 px-3 py-2 text-sm";

function formatTaille(ko: number | null): string {
  if (!ko) return "taille inconnue";
  if (ko < 1024) return `${ko} Ko`;
  return `${(ko / 1024).toFixed(1)} Mo`;
}

const CHAMPS_VIDES: DocumentInput = {
  titre: "",
  type: "notice",
  acces: "apres_achat",
  apercuUrl: "",
  nombrePages: null,
  apercuTexte: "",
  materielSupplementaire: "",
};

export function DocumentsManager({
  documents,
  kits,
}: {
  documents: DocumentAvecProduits[];
  kits: ProduitLie[];
}) {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-5">
      <AjouterDocument onDone={() => router.refresh()} />

      {documents.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-ink/15 bg-white px-4 py-8 text-center text-sm text-ink/50">
          Aucune notice pour l&apos;instant.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {documents.map((doc) => (
            <li key={doc.id}>
              <CarteDocument doc={doc} kits={kits} onDone={() => router.refresh()} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ChampsDocument({
  input,
  setInput,
}: {
  input: DocumentInput;
  setInput: (input: DocumentInput) => void;
}) {
  return (
    <>
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-ink/60">Titre</span>
        <input
          value={input.titre}
          onChange={(e) => setInput({ ...input, titre: e.target.value })}
          placeholder="Notice de montage — Station météo connectée"
          maxLength={120}
          className={CHAMP}
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <ChampSelect
          ariaLabel="Type"
          placeholder="Type…"
          className={CHAMP}
          wrapperClassName="w-36"
          value={input.type}
          onChange={(v) => setInput({ ...input, type: v as DocumentInput["type"] })}
          options={[
            { value: "notice", label: "Notice" },
            { value: "guide", label: "Guide" },
          ]}
        />
        <ChampSelect
          ariaLabel="Accès"
          placeholder="Accès…"
          className={CHAMP}
          wrapperClassName="w-40"
          value={input.acces}
          onChange={(v) => setInput({ ...input, acces: v as DocumentInput["acces"] })}
          options={[
            { value: "apres_achat", label: "Après achat" },
            { value: "libre", label: "Accès libre" },
          ]}
        />
        <label className="flex flex-col gap-1 text-xs">
          <span className="sr-only">Nombre de pages</span>
          <input
            type="number"
            min={0}
            value={input.nombrePages ?? ""}
            onChange={(e) =>
              setInput({ ...input, nombrePages: e.target.value === "" ? null : Number(e.target.value) })
            }
            placeholder="Nb pages"
            className={`${CHAMP} w-28`}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-xs">
        <span className="text-ink/60">Photo du montage terminé (URL)</span>
        <input
          value={input.apercuUrl}
          onChange={(e) => setInput({ ...input, apercuUrl: e.target.value })}
          placeholder="https://…"
          className={CHAMP}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs">
        <span className="text-ink/60">Ce qu&apos;on apprend (visible avant achat, 3-4 lignes)</span>
        <textarea
          value={input.apercuTexte}
          onChange={(e) => setInput({ ...input, apercuTexte: e.target.value })}
          maxLength={600}
          rows={3}
          className={ZONE}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs">
        <span className="text-ink/60">Matériel nécessaire en plus du kit (optionnel)</span>
        <textarea
          value={input.materielSupplementaire}
          onChange={(e) => setInput({ ...input, materielSupplementaire: e.target.value })}
          maxLength={600}
          rows={2}
          className={ZONE}
        />
      </label>
    </>
  );
}

function AjouterDocument({ onDone }: { onDone: () => void }) {
  const [input, setInput] = useState<DocumentInput>(CHAMPS_VIDES);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const file = fileRef.current?.files?.[0];
    if (!input.titre.trim()) return setError("Donne un titre au document.");
    if (!file) return setError("Choisis un fichier PDF.");

    const formData = new FormData();
    formData.set("fichier", file);

    setSubmitting(true);
    const result = await creerDocument(input, formData);
    setSubmitting(false);
    if (!result.ok) return setError(result.error);

    setInput(CHAMPS_VIDES);
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
        Ajouter une notice
      </span>

      <ChampsDocument input={input} setInput={setInput} />

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
        {submitting ? "Envoi…" : "Créer le document"}
      </button>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  );
}

function CarteDocument({
  doc,
  kits,
  onDone,
}: {
  doc: DocumentAvecProduits;
  kits: ProduitLie[];
  onDone: () => void;
}) {
  const [input, setInput] = useState<DocumentInput>({
    titre: doc.titre,
    type: doc.type,
    acces: doc.acces,
    apercuUrl: doc.apercu_url ?? "",
    nombrePages: doc.nombre_pages,
    apercuTexte: doc.apercu_texte ?? "",
    materielSupplementaire: doc.materiel_supplementaire ?? "",
  });
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState<StatsDocument | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const lancer = async (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setError(null);
    setBusy(true);
    const result = await fn();
    setBusy(false);
    if (!result.ok) return setError(result.error);
    onDone();
  };

  const enregistrer = async () => {
    await lancer(() => modifierDocument(doc.id, input));
    setEditing(false);
  };

  const remplacer = () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.set("fichier", file);
    void lancer(() => remplacerFichierDocument(doc.id, formData)).then(() => {
      if (fileRef.current) fileRef.current.value = "";
    });
  };

  const supprimer = () => {
    if (confirm(`Supprimer le document « ${doc.titre} » ?`)) {
      void lancer(() => supprimerDocument(doc.id));
    }
  };

  const voirStats = async () => {
    setStats(await getStatsDocument(doc.id));
  };

  const kitsDisponibles = kits.filter((k) => !doc.produits.some((p) => p.id === k.id));

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-white p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
          <FileText size={17} aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-sm font-medium text-ink">{doc.titre}</span>
          <span className="flex flex-wrap items-center gap-1.5 px-0 text-xs text-ink/45">
            PDF · {formatTaille(doc.taille_ko)} · {doc.type} ·{" "}
            {doc.acces === "libre" ? "accès libre" : "après achat"}
            {!doc.actif && " · masqué"}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="shrink-0 rounded-full border border-ink/15 px-2.5 py-1 text-xs font-medium text-ink/70 hover:border-brand hover:text-brand"
        >
          {editing ? "Fermer" : "Modifier"}
        </button>
        <button
          type="button"
          onClick={supprimer}
          disabled={busy}
          aria-label="Supprimer le document"
          className="shrink-0 rounded-lg p-1.5 text-ink/40 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>

      {editing && (
        <div className="flex flex-col gap-3 border-t border-ink/10 pt-3">
          <ChampsDocument input={input} setInput={setInput} />
          <label className="flex items-center gap-2 text-xs text-ink/70">
            <input
              type="checkbox"
              checked={doc.actif}
              onChange={(e) => void lancer(() => basculerActifDocument(doc.id, e.target.checked))}
            />
            Visible en aperçu public
          </label>
          <button
            type="button"
            onClick={enregistrer}
            disabled={busy}
            className="self-start rounded-full bg-brand min-h-9 px-4 text-xs font-semibold text-surface disabled:opacity-50"
          >
            Enregistrer
          </button>
        </div>
      )}

      <ProduitsDocument
        docId={doc.id}
        produits={doc.produits}
        kitsDisponibles={kitsDisponibles}
        onDone={onDone}
      />

      <div className="flex flex-wrap items-center gap-2 border-t border-ink/10 pt-3">
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={remplacer}
          className="hidden"
          id={`replace-doc-${doc.id}`}
        />
        <label
          htmlFor={`replace-doc-${doc.id}`}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/70 hover:border-brand hover:text-brand"
        >
          <RefreshCw size={13} aria-hidden="true" />
          {busy ? "…" : "Remplacer le fichier"}
        </label>
        <button
          type="button"
          onClick={voirStats}
          className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/70 hover:border-brand hover:text-brand"
        >
          <BarChart3 size={13} aria-hidden="true" />
          Statistiques (30j)
        </button>
      </div>

      {stats && (
        <p className="text-xs text-ink/60">
          {stats.telechargements30j} téléchargement(s) · {stats.acheteursDistincts30j} acheteur(s)
          distinct(s) · {stats.kitsVendus30j} kit(s) vendu(s) sur la période.
        </p>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function ProduitsDocument({
  docId,
  produits,
  kitsDisponibles,
  onDone,
}: {
  docId: number;
  produits: ProduitLie[];
  kitsDisponibles: ProduitLie[];
  onDone: () => void;
}) {
  const [choix, setChoix] = useState("");
  const [busy, setBusy] = useState(false);

  const ajouter = async () => {
    if (!choix) return;
    setBusy(true);
    await associerProduit(docId, Number(choix));
    setBusy(false);
    setChoix("");
    onDone();
  };

  const retirer = async (produitId: number) => {
    setBusy(true);
    await dissocierProduit(docId, produitId);
    setBusy(false);
    onDone();
  };

  return (
    <div className="flex flex-col gap-2 border-t border-ink/10 pt-3">
      {produits.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {produits.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1 rounded-full bg-decorative/15 py-1 pl-2.5 pr-1 text-xs text-ink/75"
            >
              {p.nom}
              <button
                type="button"
                onClick={() => retirer(p.id)}
                disabled={busy}
                aria-label={`Retirer ${p.nom}`}
                className="rounded-full p-0.5 text-ink/40 hover:bg-ink/10 hover:text-ink disabled:opacity-50"
              >
                <X size={12} aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-ink/45">Rattaché à aucun kit — invisible pour les clients.</p>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <ChampSelect
          ariaLabel="Kit"
          placeholder="Rattacher un kit…"
          className={CHAMP}
          wrapperClassName="w-64"
          value={choix}
          onChange={setChoix}
          options={kitsDisponibles.map((k) => ({ value: String(k.id), label: k.nom }))}
        />
        <button
          type="button"
          onClick={ajouter}
          disabled={busy || !choix}
          className="inline-flex items-center gap-1 rounded-full border border-ink/15 px-3 py-2 text-xs font-medium text-ink/70 hover:border-brand hover:text-brand disabled:opacity-40"
        >
          <Plus size={13} aria-hidden="true" />
          Rattacher
        </button>
      </div>
    </div>
  );
}
