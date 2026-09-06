import { etatDemande, LIBELLES_ETAT_DEMANDE } from "@/lib/preparations";
import type { StatutDemandePreparation } from "@/lib/supabase/types";

const TONS: Record<string, string> = {
  a_preparer: "bg-ink/[0.06] text-ink/60",
  preparee: "bg-brand/10 text-brand",
  recuperee: "bg-success/10 text-success",
};

export function PastilleDemande({
  statut,
  recupereeLe,
}: {
  statut: StatutDemandePreparation;
  recupereeLe: string | null;
}) {
  const etat = etatDemande(statut, recupereeLe);
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${TONS[etat]}`}>
      {LIBELLES_ETAT_DEMANDE[etat]}
    </span>
  );
}
