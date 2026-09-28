import { Loader2 } from "lucide-react";

// Indicateur de chargement en bas d'une liste avec défilement infini
// (CORRECTIONS_V14 §4) : plus visible que le simple texte précédent, et
// suffisamment d'espace pour ne jamais passer sous la barre de navigation.
export function ChargementListe() {
  return (
    <div className="flex flex-col items-center gap-2 pb-8 pt-6">
      <Loader2 size={20} className="animate-spin text-brand" aria-hidden="true" />
      <p className="text-sm text-ink/60">Chargement des produits…</p>
    </div>
  );
}
