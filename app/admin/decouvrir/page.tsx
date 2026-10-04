import { getApercuDecouvrir, getDernierJournalDecouvrir } from "@/lib/admin/decouvrir-actions";
import { DecouvrirEditeur } from "@/components/admin/decouvrir-editeur";

export const dynamic = "force-dynamic";

function formatDateHeure(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    timeZone: "Africa/Dakar",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// PROMPT_ADMIN_V2 Lot 4 : remplace la section "Épinglage & exclusion" de
// /admin/classement par un aperçu identique à l'accueil client, réordonnable.
export default async function AdminDecouvrirPage() {
  const [apercu, dernierJournal] = await Promise.all([getApercuDecouvrir(), getDernierJournalDecouvrir()]);

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <div>
        <h1 className="font-heading text-xl font-bold text-ink">Accueil : À découvrir</h1>
        <p className="mt-1 text-sm text-ink/55">
          Même ordre que ce qu&apos;un client voit sur l&apos;accueil. Glisser-déposer sur
          ordinateur, flèches sur téléphone. Les changements ne s&apos;appliquent qu&apos;après
          « Enregistrer ».
        </p>
        {dernierJournal && (
          <p className="mt-2 text-xs text-ink/40">
            Dernier enregistrement : {dernierJournal.resume} — {formatDateHeure(dernierJournal.majLe)}
            {dernierJournal.email ? ` (${dernierJournal.email})` : ""}
          </p>
        )}
      </div>

      <DecouvrirEditeur initial={apercu} />
    </div>
  );
}
