"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Pencil, Phone, Plus, Trash2 } from "lucide-react";
import { CartePin, type Coordonnees } from "@/components/checkout/carte-pin";
import {
  creerFournisseur,
  modifierFournisseur,
  supprimerFournisseur,
} from "@/lib/admin/fournisseurs-actions";
import type { Fournisseur, PalierTarif } from "@/lib/supabase/types";
import { formatPrice } from "@/lib/format";

const CHAMP =
  "min-h-11 rounded-xl border border-ink/15 px-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25";

// "< 150 000 : 10 000 · < 200 000 : 15 000 · au-delà : 25 000"
function resumeGrille(grille: PalierTarif[]): string {
  return grille
    .map((p) => `${p.seuil === null ? "au-delà" : `< ${formatPrice(p.seuil)}`} : ${formatPrice(p.valeur)}`)
    .join(" · ");
}

// Éditeur de grille par palier (remise ou majoration fournisseur) : une ligne
// par palier (seuil haut du prix affiché + montant), le dernier palier n'a
// jamais de seuil (illimité). Pas de nouveau composant générique ailleurs
// dans le code -> volontairement local à cet écran.
function EditeurGrille({
  label,
  aide,
  grille,
  onChange,
}: {
  label: string;
  aide: string;
  grille: PalierTarif[] | null;
  onChange: (grille: PalierTarif[] | null) => void;
}) {
  const paliers = grille ?? [];

  const majPalier = (index: number, champ: "seuil" | "valeur", brut: string) => {
    const nombre = brut.trim() === "" ? null : Number(brut);
    const suivant = paliers.map((p, i) =>
      i === index ? { ...p, [champ]: champ === "valeur" ? (nombre ?? 0) : nombre } : p,
    );
    onChange(suivant);
  };

  const ajouterPalier = () => {
    // Le nouveau palier devient le dernier (illimité) ; l'ancien dernier
    // reçoit un seuil à compléter par l'admin.
    const avecSeuil = paliers.map((p, i) => (i === paliers.length - 1 ? { ...p, seuil: p.seuil ?? 0 } : p));
    onChange([...avecSeuil, { seuil: null, valeur: 0 }]);
  };

  const retirerPalier = (index: number) => {
    const suivant = paliers.filter((_, i) => i !== index);
    onChange(suivant.length === 0 ? null : suivant);
  };

  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <span className="text-xs font-medium text-ink/60">{label}</span>
      <p className="text-[11px] text-ink/40">{aide}</p>
      {paliers.map((palier, index) => (
        <div key={index} className="flex items-center gap-1.5">
          {index === paliers.length - 1 ? (
            <span className="min-h-9 flex-1 rounded-lg bg-ink/5 px-2.5 text-xs leading-9 text-ink/50">
              Au-delà
            </span>
          ) : (
            <input
              type="number"
              inputMode="numeric"
              placeholder="Seuil FCFA"
              value={palier.seuil ?? ""}
              onChange={(e) => majPalier(index, "seuil", e.target.value)}
              className="min-h-9 flex-1 rounded-lg border border-ink/15 px-2.5 text-xs focus:border-brand focus:outline-none"
            />
          )}
          <input
            type="number"
            inputMode="numeric"
            placeholder="Montant FCFA"
            value={palier.valeur ?? ""}
            onChange={(e) => majPalier(index, "valeur", e.target.value)}
            className="min-h-9 w-28 rounded-lg border border-ink/15 px-2.5 text-xs focus:border-brand focus:outline-none"
          />
          <button
            type="button"
            onClick={() => retirerPalier(index)}
            aria-label="Retirer ce palier"
            className="rounded-lg p-1.5 text-ink/40 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 size={14} aria-hidden="true" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={ajouterPalier}
        className="flex w-fit items-center gap-1 rounded-full border border-ink/15 px-2.5 py-1 text-[11px] font-medium text-ink/60"
      >
        <Plus size={12} aria-hidden="true" />
        Ajouter un palier
      </button>
    </div>
  );
}

export function FournisseursEditor({ fournisseurs }: { fournisseurs: Fournisseur[] }) {
  // null = aucun formulaire ouvert ; "nouveau" = création ; un objet = édition.
  const [cible, setCible] = useState<Fournisseur | "nouveau" | null>(null);

  return (
    <div className="flex flex-col gap-4">
      {cible === null && (
        <button
          type="button"
          onClick={() => setCible("nouveau")}
          className="flex min-h-11 w-fit items-center gap-1.5 rounded-full bg-brand px-4 text-sm font-semibold text-surface active:scale-95"
        >
          <Plus size={16} aria-hidden="true" />
          Ajouter un fournisseur
        </button>
      )}

      {cible !== null && (
        <FormFournisseur
          fournisseur={cible === "nouveau" ? null : cible}
          onFini={() => setCible(null)}
        />
      )}

      {fournisseurs.length === 0 ? (
        <p className="rounded-2xl border border-ink/10 bg-white px-4 py-8 text-center text-sm text-ink/50">
          Aucun fournisseur enregistré.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {fournisseurs.map((f) => (
            <li
              key={f.id}
              className="flex flex-col gap-1.5 rounded-2xl border border-ink/10 bg-white p-3.5 text-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-ink">{f.nom}</p>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => setCible(f)}
                    aria-label={`Modifier ${f.nom}`}
                    className="rounded-lg p-1.5 text-ink/60 hover:bg-ink/5"
                  >
                    <Pencil size={15} aria-hidden="true" />
                  </button>
                  <SupprimerBouton fournisseur={f} />
                </div>
              </div>
              {f.adresse && <p className="text-ink/60">{f.adresse}</p>}
              {f.telephone && (
                <p className="flex items-center gap-1 text-xs text-ink/50">
                  <Phone size={12} aria-hidden="true" />
                  {f.telephone}
                </p>
              )}
              <p className="flex items-center gap-1 text-xs text-ink/40">
                <MapPin size={12} aria-hidden="true" />
                {f.lat != null && f.lng != null
                  ? `${f.lat.toFixed(5)}, ${f.lng.toFixed(5)}`
                  : "Position non renseignée"}
              </p>
              {(f.grilleRemise || f.grilleMajoration) && (
                <div className="flex flex-col gap-0.5 rounded-lg bg-ink/5 px-2.5 py-2 text-xs text-ink/60">
                  {f.grilleRemise && <p>Remise : {resumeGrille(f.grilleRemise)}</p>}
                  {f.grilleMajoration && <p>Majoration : {resumeGrille(f.grilleMajoration)}</p>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FormFournisseur({
  fournisseur,
  onFini,
}: {
  fournisseur: Fournisseur | null;
  onFini: () => void;
}) {
  const router = useRouter();
  const [nom, setNom] = useState(fournisseur?.nom ?? "");
  const [adresse, setAdresse] = useState(fournisseur?.adresse ?? "");
  const [telephone, setTelephone] = useState(fournisseur?.telephone ?? "");
  const [position, setPosition] = useState<Coordonnees | null>(
    fournisseur?.lat != null && fournisseur?.lng != null
      ? { lat: fournisseur.lat, lng: fournisseur.lng }
      : null,
  );
  const [grilleRemise, setGrilleRemise] = useState<PalierTarif[] | null>(
    fournisseur?.grilleRemise ?? null,
  );
  const [grilleMajoration, setGrilleMajoration] = useState<PalierTarif[] | null>(
    fournisseur?.grilleMajoration ?? null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enregistrer = async () => {
    setSubmitting(true);
    setError(null);
    const input = {
      nom: nom.trim(),
      adresse: adresse.trim() || null,
      telephone: telephone.trim() || null,
      lat: position?.lat ?? null,
      lng: position?.lng ?? null,
      grilleRemise,
      grilleMajoration,
    };
    const res = fournisseur
      ? await modifierFournisseur(fournisseur.id, input)
      : await creerFournisseur(input);
    if (!res.ok) {
      setError(res.error);
      setSubmitting(false);
      return;
    }
    router.refresh();
    onFini();
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-brand/25 bg-white p-4">
      <p className="text-sm font-semibold text-ink">
        {fournisseur ? `Modifier « ${fournisseur.nom} »` : "Nouveau fournisseur"}
      </p>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-medium text-ink/60">Nom</span>
        <input value={nom} onChange={(e) => setNom(e.target.value)} className={CHAMP} />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-medium text-ink/60">
          Adresse / point de repère <span className="text-ink/40">(facultatif)</span>
        </span>
        <input value={adresse} onChange={(e) => setAdresse(e.target.value)} className={CHAMP} />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-medium text-ink/60">
          Téléphone <span className="text-ink/40">(facultatif)</span>
        </span>
        <input
          value={telephone}
          onChange={(e) => setTelephone(e.target.value)}
          className={CHAMP}
        />
      </label>

      <div className="flex flex-col gap-1.5 text-sm">
        <span className="text-xs font-medium text-ink/60">Où récupérer la marchandise ?</span>
        <CartePin position={position} onChange={setPosition} />
      </div>

      <EditeurGrille
        label="Grille de remise"
        aide="Réduction sur le prix affiché par ce fournisseur, selon un palier de prix."
        grille={grilleRemise}
        onChange={setGrilleRemise}
      />
      <EditeurGrille
        label="Grille de majoration"
        aide="Ajout au prix affiché pour obtenir le prix de vente SacAdo, selon un palier de prix."
        grille={grilleMajoration}
        onChange={setGrilleMajoration}
      />

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={enregistrer}
          disabled={submitting || !nom.trim()}
          className="min-h-11 flex-1 rounded-full bg-brand px-4 text-sm font-semibold text-surface active:scale-95 disabled:opacity-50 sm:flex-none"
        >
          {submitting ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button
          type="button"
          onClick={onFini}
          className="min-h-11 rounded-full border border-ink/15 px-4 text-sm font-medium text-ink/70"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}

function SupprimerBouton({ fournisseur }: { fournisseur: Fournisseur }) {
  const router = useRouter();
  const [confirme, setConfirme] = useState(false);
  const [enCours, setEnCours] = useState(false);

  const supprimer = async () => {
    setEnCours(true);
    await supprimerFournisseur(fournisseur.id);
    router.refresh();
  };

  if (confirme) {
    return (
      <span className="flex items-center gap-1.5 text-xs">
        <button
          type="button"
          onClick={supprimer}
          disabled={enCours}
          className="rounded-lg bg-red-600 px-2 py-1 font-medium text-white disabled:opacity-50"
        >
          Supprimer
        </button>
        <button type="button" onClick={() => setConfirme(false)} className="text-ink/50">
          Annuler
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirme(true)}
      aria-label={`Supprimer ${fournisseur.nom}`}
      className="rounded-lg p-1.5 text-ink/50 hover:bg-red-50 hover:text-red-600"
    >
      <Trash2 size={15} aria-hidden="true" />
    </button>
  );
}
