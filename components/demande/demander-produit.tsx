"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ImagePlus, Loader2, PackageSearch, X } from "lucide-react";
import { useIdentite } from "@/lib/local/identite";
import {
  creerDemandeProduit,
  televerserPhotoDemande,
  type OrigineDemande,
} from "@/lib/demandes/actions";

const CHAMP =
  "w-full rounded-xl border border-ink/15 bg-transparent px-3 py-2.5 text-sm text-ink placeholder:text-ink/40 focus:border-brand focus:outline-none";

type Variante = "primaire" | "carte" | "discret";

export function DemanderProduit({
  origine,
  termeRecherche,
  variante = "primaire",
}: {
  origine: OrigineDemande;
  termeRecherche?: string;
  variante?: Variante;
}) {
  const [ouvert, setOuvert] = useState(false);

  useEffect(() => {
    if (!ouvert) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOuvert(false);
    };
    const root = document.documentElement;
    const avant = root.style.overflow;
    root.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      root.style.overflow = avant;
      window.removeEventListener("keydown", onKey);
    };
  }, [ouvert]);

  return (
    <>
      <Declencheur variante={variante} onClick={() => setOuvert(true)} />
      {ouvert && (
        <Panneau
          origine={origine}
          termeRecherche={termeRecherche}
          onClose={() => setOuvert(false)}
        />
      )}
    </>
  );
}

function Declencheur({ variante, onClick }: { variante: Variante; onClick: () => void }) {
  if (variante === "carte") {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 rounded-2xl border border-ink/10 bg-elevated p-4 text-left transition-colors active:scale-[0.99]"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
          <PackageSearch size={18} aria-hidden="true" />
        </span>
        <span className="flex flex-col">
          <span className="text-sm font-semibold text-ink">Demander un produit</span>
          <span className="text-xs text-ink/55">
            Tu ne trouves pas un article ? On le cherche pour toi.
          </span>
        </span>
      </button>
    );
  }

  if (variante === "discret") {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-8 text-center">
        <p className="text-sm text-ink/55">Tu ne trouves pas ce que tu cherches dans ce rayon ?</p>
        <button
          type="button"
          onClick={onClick}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-brand px-4 text-sm font-semibold text-brand transition-colors active:scale-95"
        >
          <PackageSearch size={15} aria-hidden="true" />
          Demander un produit
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-brand px-5 text-sm font-semibold text-on-brand transition-transform active:scale-95"
    >
      <PackageSearch size={16} aria-hidden="true" />
      Demander un produit
    </button>
  );
}

function Panneau({
  origine,
  termeRecherche,
  onClose,
}: {
  origine: OrigineDemande;
  termeRecherche?: string;
  onClose: () => void;
}) {
  const { identite } = useIdentite();
  const connecte = Boolean(identite?.telephone && identite?.jeton);

  const [description, setDescription] = useState(
    origine === "recherche_vide" && termeRecherche ? termeRecherche : "",
  );
  const [precision, setPrecision] = useState("");
  const [telephone, setTelephone] = useState(identite?.telephone ?? "");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoEnCours, setPhotoEnCours] = useState(false);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoye, setEnvoye] = useState(false);
  const fichierRef = useRef<HTMLInputElement>(null);

  const choisirPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoEnCours(true);
    setErreur(null);
    const fd = new FormData();
    fd.set("file", file);
    const r = await televerserPhotoDemande(fd);
    setPhotoEnCours(false);
    if (r.ok) setPhotoUrl(r.url);
    else setErreur(r.error);
  };

  const envoyer = async () => {
    if (!description.trim() || busy) return;
    setBusy(true);
    setErreur(null);
    const r = await creerDemandeProduit({
      description,
      precisionProduit: precision || null,
      photoUrl,
      origine,
      termeRecherche: termeRecherche ?? null,
      telephone: telephone || identite?.telephone || null,
      jeton: connecte ? identite?.jeton ?? null : null,
    });
    setBusy(false);
    if (r.ok) setEnvoye(true);
    else setErreur(r.error);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className="absolute inset-0 bg-ink/40"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Demander un produit"
        className="animate-fade-in-up relative flex max-h-[90vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-3xl bg-surface p-5 shadow-xl sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-heading text-lg font-bold text-ink">Demander un produit</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="-mr-1 -mt-1 rounded-lg p-1.5 text-ink/50 hover:bg-ink/5"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {envoye ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-success/10 text-success">
              <Check size={24} aria-hidden="true" />
            </span>
            <p className="max-w-xs text-sm text-ink/75">
              C&apos;est noté. On cherche ce produit et on te répond sur WhatsApp dès qu&apos;on
              l&apos;a trouvé.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-1 h-10 rounded-full bg-brand px-5 text-sm font-semibold text-on-brand"
            >
              Fermer
            </button>
          </div>
        ) : (
          <>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-ink/60">Ce que tu cherches</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={600}
                placeholder="Ex : une calculatrice scientifique Casio, un cartable à roulettes taille 40…"
                className={CHAMP}
                autoFocus
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-ink/60">
                Une précision <span className="text-ink/40">(facultatif)</span>
              </span>
              <input
                value={precision}
                onChange={(e) => setPrecision(e.target.value)}
                maxLength={300}
                placeholder="Marque, taille, modèle, quantité…"
                className={CHAMP}
              />
            </label>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-ink/60">
                Une photo ou capture d&apos;écran <span className="text-ink/40">(facultatif)</span>
              </span>
              {photoUrl ? (
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoUrl}
                    alt=""
                    className="size-16 rounded-xl border border-ink/10 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setPhotoUrl(null)}
                    className="text-xs font-medium text-ink/55 underline"
                  >
                    Retirer
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fichierRef.current?.click()}
                  disabled={photoEnCours}
                  className="inline-flex h-10 w-fit items-center gap-2 rounded-xl border border-ink/15 px-3 text-sm text-ink/70 disabled:opacity-50"
                >
                  {photoEnCours ? (
                    <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <ImagePlus size={15} aria-hidden="true" />
                  )}
                  Ajouter une image
                </button>
              )}
              <input
                ref={fichierRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={choisirPhoto}
                className="hidden"
              />
            </div>

            {!connecte && (
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-ink/60">Ton numéro WhatsApp</span>
                <input
                  type="tel"
                  inputMode="tel"
                  value={telephone}
                  onChange={(e) => setTelephone(e.target.value)}
                  maxLength={30}
                  placeholder="77 123 45 67"
                  className={CHAMP}
                />
                <span className="text-[11px] text-ink/45">
                  On te répond ici dès qu&apos;on a trouvé le produit.
                </span>
              </label>
            )}

            {erreur && <p className="text-xs text-red-600">{erreur}</p>}

            <button
              type="button"
              onClick={envoyer}
              disabled={busy || photoEnCours || !description.trim()}
              className="flex h-11 items-center justify-center gap-2 rounded-full bg-brand text-sm font-semibold text-on-brand transition-transform active:scale-95 disabled:opacity-50"
            >
              {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : "Envoyer"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
