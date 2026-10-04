"use client";

import { useState } from "react";
import { LocateFixed, Loader2, MapPin } from "lucide-react";
import { lienGoogleMapsDepuisCoordonnees } from "@/lib/checkout/localisation";
import { resoudreLienLocalisation } from "@/lib/checkout/localisation-actions";
import { CartePin, type Coordonnees } from "@/components/checkout/carte-pin";

export type SourceLocalisation = "position" | "lien" | "deplace" | null;

export type ValeurLocalisation = {
  lat: number | null;
  lng: number | null;
  lien: string | null;
  // Comment le point a été obtenu — PROMPT_CLIENT_LOCALISATION.md Lot 2,
  // traçabilité posée sur la commande (purement descriptif).
  source: SourceLocalisation;
};

// Bloc "Localisation" du checkout (PROMPT_CLIENT_LOCALISATION.md Lot 1) :
// position GPS, lien Google Maps collé, ou point déplacé/cliqué directement
// sur la petite carte — les trois méthodes alimentent le même point, qui
// détermine ensuite la localité et les frais côté serveur.
export function LocalisationCarte({
  value,
  onChange,
}: {
  value: ValeurLocalisation;
  onChange: (valeur: ValeurLocalisation) => void;
}) {
  const [geoloc, setGeoloc] = useState<"idle" | "chargement" | "refus" | "indispo">("idle");
  // Texte du champ lien : distinct de value.lien tant que la résolution n'a
  // pas abouti (pour afficher l'erreur sans perdre la dernière position valide).
  const [texteLien, setTexteLien] = useState(value.lien ?? "");
  const [resolution, setResolution] = useState<"idle" | "chargement" | "erreur">("idle");
  const [erreurLien, setErreurLien] = useState<string | null>(null);

  const localiser = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoloc("indispo");
      return;
    }
    setGeoloc("chargement");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoloc("idle");
        const { latitude: lat, longitude: lng } = pos.coords;
        const lien = lienGoogleMapsDepuisCoordonnees(lat, lng);
        setTexteLien(lien);
        setErreurLien(null);
        onChange({ lat, lng, lien, source: "position" });
      },
      () => setGeoloc("refus"),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  };

  const validerLien = async () => {
    const saisie = texteLien.trim();
    if (!saisie) {
      onChange({ lat: null, lng: null, lien: null, source: null });
      setErreurLien(null);
      return;
    }
    // Déjà validé tel quel (ex. reconstruit depuis la géoloc ou la carte) :
    // rien à refaire.
    if (saisie === value.lien) return;

    setResolution("chargement");
    setErreurLien(null);
    try {
      const r = await resoudreLienLocalisation(saisie);
      if (!r.ok) {
        setResolution("erreur");
        setErreurLien(r.error);
        return;
      }
      setResolution("idle");
      if (r.lat == null || r.lng == null) {
        // Lien accepté (gardé pour l'admin) mais sans coordonnées exploitables :
        // on guide vers les deux autres méthodes plutôt que de laisser un point
        // fantôme (PROMPT_CLIENT_LOCALISATION.md Lot 2).
        setErreurLien("Lien non reconnu. Utilise le bouton « Ma position » ou déplace le point sur la carte.");
        return;
      }
      onChange({ lat: r.lat, lng: r.lng, lien: r.lien, source: "lien" });
    } catch {
      setResolution("erreur");
      setErreurLien("La connexion a été interrompue. Réessaie.");
    }
  };

  const positionCarte: Coordonnees | null =
    value.lat != null && value.lng != null ? { lat: value.lat, lng: value.lng } : null;

  const deplacerSurCarte = (pos: Coordonnees) => {
    const lien = lienGoogleMapsDepuisCoordonnees(pos.lat, pos.lng);
    setTexteLien(lien);
    setErreurLien(null);
    onChange({ lat: pos.lat, lng: pos.lng, lien, source: "deplace" });
  };

  return (
    <section className="flex flex-col gap-2.5 rounded-2xl border border-ink/10 bg-elevated p-3">
      <span className="flex items-center gap-1.5 text-xs font-medium text-ink/60">
        <MapPin size={14} className="text-brand" aria-hidden="true" />
        Localisation
      </span>

      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={localiser}
          disabled={geoloc === "chargement"}
          className="flex h-11 items-center justify-center gap-2 rounded-xl border border-brand/30 bg-brand/5 text-sm font-semibold text-brand transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {geoloc === "chargement" ? (
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          ) : (
            <LocateFixed size={16} aria-hidden="true" />
          )}
          {geoloc === "chargement" ? "Localisation…" : "Utiliser ma position actuelle"}
        </button>

        {geoloc === "refus" && (
          <p className="text-xs text-ink/60">
            Position refusée. Colle ton lien Google Maps ci-dessous, ou place le point à la main sur la carte.
          </p>
        )}
        {geoloc === "indispo" && (
          <p className="text-xs text-ink/60">
            La localisation n&apos;est pas disponible sur cet appareil. Colle ton lien Google Maps
            ci-dessous, ou place le point à la main sur la carte.
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 text-[11px] text-ink/40">
        <span className="h-px flex-1 bg-ink/10" />
        ou
        <span className="h-px flex-1 bg-ink/10" />
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-medium text-ink/60">Ou collez votre lien Google Maps</span>
        <input
          type="text"
          value={texteLien}
          onChange={(event) => {
            setTexteLien(event.target.value);
            setErreurLien(null);
          }}
          onBlur={validerLien}
          placeholder="https://maps.app.goo.gl/…"
          className="rounded-xl border border-ink/15 bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-ink/35 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
        />
        <span className="text-[11px] text-ink/45">
          Dans Google Maps, touche ta position, puis Partager, puis Copier le lien.
        </span>
      </label>

      {resolution === "chargement" && (
        <p className="flex items-center gap-1.5 text-[11px] text-ink/50">
          <Loader2 size={12} className="animate-spin" aria-hidden="true" />
          Vérification du lien…
        </p>
      )}
      {erreurLien && <p className="text-[11px] text-red-600">{erreurLien}</p>}

      <CartePin position={positionCarte} onChange={deplacerSurCarte} />
      <p className="text-[11px] text-ink/45">
        {positionCarte
          ? "Ajuste l'épingle si elle n'est pas au bon endroit."
          : "Tu peux aussi placer l'épingle directement sur la carte."}
      </p>
    </section>
  );
}
