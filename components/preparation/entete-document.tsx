import Image from "next/image";
import { ENTREPRISE } from "@/lib/entreprise";
import { refPreparation, formatDateHeureDakar } from "@/lib/preparations";

// En-tête « document SacAdo » du bon de préparation (NOTE_ACCES_FOURNISSEURS) :
// logo + wordmark, NINEA, référence, date + heure (fuseau Dakar, fait foi).
export function EnteteDocument({ demandeId, creeLe }: { demandeId: number; creeLe: string }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-ink/15 pb-4">
      <div className="flex items-center gap-3">
        <Image
          src={ENTREPRISE.logo}
          alt=""
          width={48}
          height={48}
          className="size-12 rounded-xl object-contain"
        />
        <div>
          <p className="font-heading text-lg font-bold text-brand">{ENTREPRISE.nomCommercial}</p>
          <p className="text-xs text-ink/50">NINEA : {ENTREPRISE.ninea}</p>
        </div>
      </div>
      <div className="text-right text-xs text-ink/60">
        <p className="text-sm font-semibold text-ink">Bon de préparation</p>
        <p>{refPreparation(demandeId)}</p>
        <p>Demandé le {formatDateHeureDakar(creeLe)}</p>
      </div>
    </header>
  );
}
