import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { InstallCard } from "@/components/pwa/install-card";

// Menu court (TACHE_nettoyage_carrousel_preferences.md §C.1) : tous les
// réglages ajustables (thème, notifications, recommandations, livraison,
// compte, suppression) vivent désormais dans Préférences.
export default function ParametresPage() {
  return (
    <div className="animate-fade-in-up flex flex-col gap-5 px-4 py-4">
      <h1 className="font-heading text-xl font-bold text-ink">Paramètres</h1>

      <InstallCard />

      <section className="flex flex-col divide-y divide-ink/10 rounded-2xl border border-ink/10 bg-elevated">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-ink">Langue</span>
          <span className="text-xs text-ink/50">Français</span>
        </div>
        <Link href="/moi/parametres/preferences" className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-ink">Préférences</span>
          <ChevronRight size={16} className="text-ink/40" aria-hidden="true" />
        </Link>
        <Link href="/politique-confidentialite" className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-ink">Confidentialité</span>
          <span className="text-xs text-brand">Voir la politique →</span>
        </Link>
      </section>
    </div>
  );
}
