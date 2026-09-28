"use client";

import { useState } from "react";
import { Pencil, TriangleAlert } from "lucide-react";
import { useIdentite, type Identite } from "@/lib/local/identite";
import { modifierNomClient, modifierTelephoneClient, supprimerCompte } from "@/lib/moi/actions";
import { SacadosSection } from "@/components/moi/sacados-section";

export function CompteSection() {
  const { identite, setIdentite, oublier } = useIdentite();

  return (
    <>
      <section className="flex flex-col divide-y divide-ink/10 rounded-2xl border border-ink/10 bg-elevated">
        <div className="flex flex-col gap-2 px-4 py-3">
          <span className="text-sm text-ink">Mes informations</span>
          {identite ? (
            <InfosCompte identite={identite} onChange={(next) => setIdentite(next)} />
          ) : (
            <span className="text-xs text-ink/50">Aucune commande enregistrée sur cet appareil</span>
          )}
        </div>
      </section>

      <SacadosSection />

      {identite && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              oublier();
              // Rechargement COMPLET voulu : on repart du tout début de l'app
              // (splash + écran de bienvenue), sans état résiduel de session.
              // eslint-disable-next-line @next/next/no-location-assign-relative-destination
              window.location.href = "/";
            }}
            className="self-start rounded-full border border-ink/15 px-4 py-2 text-sm font-medium text-ink transition-colors active:scale-95"
          >
            Se déconnecter
          </button>

          {identite.jeton && <SupprimerCompte identite={identite} />}
        </div>
      )}
    </>
  );
}

// Nom ET numéro modifiables (CORRECTIONS_V14 §1). Sans jeton (aucune commande
// passée depuis cet appareil : identité purement locale), l'édition ne touche
// que le stockage local, pas de compte serveur à mettre à jour.
function InfosCompte({ identite, onChange }: { identite: Identite; onChange: (identite: Identite) => void }) {
  const [edition, setEdition] = useState(false);
  const [nom, setNom] = useState(identite.nom);
  const [telephone, setTelephone] = useState(identite.telephone);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  if (!edition) {
    return (
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-ink/50">
          {identite.nom || "—"} · {identite.telephone}
        </span>
        <button
          type="button"
          onClick={() => {
            setNom(identite.nom);
            setTelephone(identite.telephone);
            setErreur(null);
            setEdition(true);
          }}
          aria-label="Modifier mes informations"
          className="shrink-0 rounded-lg p-1.5 text-ink/50 hover:bg-ink/5"
        >
          <Pencil size={14} aria-hidden="true" />
        </button>
      </div>
    );
  }

  const enregistrer = async () => {
    const nomSaisi = nom.trim();
    const telSaisi = telephone.trim();
    if (!nomSaisi || telSaisi.length < 6) {
      setErreur("Renseigne un nom et un numéro valides.");
      return;
    }
    setEnCours(true);
    setErreur(null);

    if (identite.jeton) {
      if (nomSaisi !== identite.nom) {
        const res = await modifierNomClient(identite.telephone, identite.jeton, nomSaisi);
        if (!res.ok) {
          setErreur(res.error);
          setEnCours(false);
          return;
        }
      }
      if (telSaisi !== identite.telephone) {
        const res = await modifierTelephoneClient(identite.telephone, identite.jeton, telSaisi);
        if (!res.ok) {
          setErreur(res.error);
          setEnCours(false);
          return;
        }
      }
    }

    onChange({ ...identite, nom: nomSaisi, telephone: telSaisi });
    setEnCours(false);
    setEdition(false);
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1">
        <span className="text-[11px] text-ink/45">Nom complet</span>
        <input
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          className="min-h-10 rounded-xl border border-ink/15 px-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
          autoFocus
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] text-ink/45">Téléphone</span>
        <input
          type="tel"
          inputMode="tel"
          value={telephone}
          onChange={(e) => setTelephone(e.target.value)}
          className="min-h-10 rounded-xl border border-ink/15 px-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
        />
      </label>
      {erreur && <p className="text-xs text-red-600">{erreur}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={enregistrer}
          disabled={enCours || !nom.trim() || !telephone.trim()}
          className="min-h-9 rounded-full bg-brand px-3.5 text-xs font-semibold text-on-brand active:scale-95 disabled:opacity-50"
        >
          {enCours ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button
          type="button"
          onClick={() => setEdition(false)}
          className="min-h-9 rounded-full border border-ink/15 px-3.5 text-xs font-medium text-ink/70"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}

// Confirmation en deux temps (TACHE_nettoyage_carrousel_preferences.md §C.7) :
// un 1er bouton ouvre l'avertissement, un 2e bouton explicite déclenche l'action.
// Anonymise le compte (voir lib/moi/actions.ts::supprimerCompte) — les
// commandes restent pour la compta mais ne sont plus rattachées à une identité.
function SupprimerCompte({ identite }: { identite: Identite }) {
  const { oublier } = useIdentite();
  const [etape, setEtape] = useState<"repos" | "confirme" | "encours">("repos");
  const [erreur, setErreur] = useState<string | null>(null);

  if (etape === "repos") {
    return (
      <button
        type="button"
        onClick={() => setEtape("confirme")}
        className="self-start rounded-full border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition-colors active:scale-95"
      >
        Supprimer mon compte
      </button>
    );
  }

  const confirmer = async () => {
    if (!identite.jeton) return;
    setEtape("encours");
    setErreur(null);
    const res = await supprimerCompte(identite.telephone, identite.jeton);
    if (!res.ok) {
      setErreur(res.error ?? "Une erreur est survenue, réessaie.");
      setEtape("confirme");
      return;
    }
    oublier();
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/";
  };

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
      <p className="flex items-start gap-1.5 text-xs text-ink/70">
        <TriangleAlert size={13} className="mt-0.5 shrink-0 text-red-600" aria-hidden="true" />
        Ton nom, ton numéro et tes données personnelles (favoris, consultés, sacados, boîte de
        réception) seront effacés. Cette action est irréversible.
      </p>
      {erreur && <p className="text-xs text-red-600">{erreur}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={confirmer}
          disabled={etape === "encours"}
          className="min-h-9 rounded-full bg-red-600 px-3.5 text-xs font-semibold text-white active:scale-95 disabled:opacity-50"
        >
          {etape === "encours" ? "…" : "Oui, supprimer définitivement"}
        </button>
        <button
          type="button"
          onClick={() => setEtape("repos")}
          disabled={etape === "encours"}
          className="min-h-9 rounded-full border border-ink/15 px-3.5 text-xs font-medium text-ink/70"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
