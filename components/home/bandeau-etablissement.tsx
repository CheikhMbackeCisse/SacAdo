import Link from "next/link";
import { Building2, ChevronRight } from "lucide-react";

// Entrée dédiée vers "Impression et consommables" (TACHE_kits_impression
// _classement.md Chantier B) : ce rayon s'adresse aux établissements et
// secrétariats, pas au flux grand public — la catégorie est donc retirée de
// la grille Catégories (voir page d'accueil) et accessible uniquement via ce
// bandeau discret.
export function BandeauEtablissement() {
  return (
    <div className="px-4 pt-3">
      <Link
        href="/categorie/impression-consommables"
        className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-white px-4 py-3 active:scale-[0.99]"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
          <Building2 size={18} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-ink">Vous êtes un établissement ?</span>
          <span className="block text-xs text-ink/55">
            Imprimantes, photocopieurs et consommables pour votre bureau
          </span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-ink/30" aria-hidden="true" />
      </Link>
    </div>
  );
}
