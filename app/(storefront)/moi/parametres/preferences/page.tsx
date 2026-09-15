"use client";

import { AffichageSection } from "@/components/moi/preferences/affichage-section";
import { RecommandationsSection } from "@/components/moi/preferences/recommandations-section";
import { LivraisonSection } from "@/components/moi/preferences/livraison-section";
import { CompteSection } from "@/components/moi/preferences/compte-section";
import { PreferencesNotificationsSection } from "@/components/moi/preferences-notifications";
import { ActiverPushClient } from "@/components/moi/activer-push-client";

// TACHE_nettoyage_carrousel_preferences.md §C : cinq sections (Affichage,
// Recommandations, Notifications, Livraison, Compte). Chaque réglage s'applique
// immédiatement, pas de bouton "Enregistrer" (§C.4).
export default function PreferencesPage() {
  return (
    <div className="animate-fade-in-up flex flex-col gap-5 px-4 py-4">
      <h1 className="font-heading text-xl font-bold text-ink">Préférences</h1>

      <AffichageSection />

      <RecommandationsSection />

      <section className="flex flex-col divide-y divide-ink/10 rounded-2xl border border-ink/10 bg-elevated">
        <ActiverPushClient />
        <PreferencesNotificationsSection />
      </section>

      <LivraisonSection />

      <CompteSection />
    </div>
  );
}
