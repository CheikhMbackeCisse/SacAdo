"use client";

import { useState } from "react";
import { ExternalLink, LocateFixed, Loader2, MapPin } from "lucide-react";
import { lienGoogleMapsDepuisCoordonnees } from "@/lib/checkout/localisation";
import { resoudreLienLocalisation } from "@/lib/checkout/localisation-actions";

export type ValeurLocalisation = {
  lat: number | null;
  lng: number | null;
  lien: string | null;
};

// Bloc "Localisation" du checkout (PROMPT_CLIENT_V2 Lot 2) : position GPS ou
// lien Google Maps collé — remplace le champ libre "Comment trouver ta porte".
export function LocalisationInput({
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
        onChange({ lat, lng, lien });
      },
      () => setGeoloc("refus"),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  };

  const validerLien = async () => {
    const saisie = texteLien.trim();
    if (!saisie) {
      onChange({ lat: null, lng: null, lien: null });
      setErreurLien(null);
      return;
    }
    // Déjà validé tel quel (ex. reconstruit depuis la géoloc) : rien à refaire.
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
      onChange({ lat: r.lat, lng: r.lng, lien: r.lien });
    } catch {
      setResolution("erreur");
      setErreurLien("La connexion a été interrompue. Réessaie.");
    }
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

        {value.lat != null && value.lng != null && (
          <p className="flex items-center gap-1.5 text-xs text-ink/60">
            Position enregistrée
            {value.lien && (
              <a
                href={value.lien}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-brand"
              >
                Voir sur la carte
                <ExternalLink size={11} aria-hidden="true" />
              </a>
            )}
          </p>
        )}

        {geoloc === "refus" && (
          <p className="text-xs text-ink/60">
            Position refusée. Colle ton lien Google Maps ci-dessous à la place.
          </p>
        )}
        {geoloc === "indispo" && (
          <p className="text-xs text-ink/60">
            La localisation n&apos;est pas disponible sur cet appareil. Colle ton lien Google Maps
            ci-dessous à la place.
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
    </section>
  );
}
