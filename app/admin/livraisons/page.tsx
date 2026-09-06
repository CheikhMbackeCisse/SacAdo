import Link from "next/link";
import { MapPinned } from "lucide-react";
import { getLivraisons } from "@/lib/admin/livraisons-actions";
import { getFournisseurs } from "@/lib/admin/fournisseurs-actions";
import { CarteLivraisons } from "@/components/admin/carte-livraisons";

export const dynamic = "force-dynamic";

export default async function AdminLivraisonsPage() {
  const [commandes, fournisseurs] = await Promise.all([getLivraisons(), getFournisseurs()]);

  return (
    <div className="flex h-[calc(100dvh-5.5rem)] flex-col gap-3 lg:h-[calc(100dvh-3rem)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="font-heading text-xl font-bold text-ink">Livraisons</h1>
          <p className="mt-1 text-sm text-ink/55">
            Commandes à livrer et points de retrait, pour organiser les tournées. Une
            commande disparaît de la carte dès qu&apos;elle est marquée « livrée ».
          </p>
        </div>
        <Link
          href="/admin/lieux"
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/70 transition-colors hover:border-brand hover:text-brand"
        >
          <MapPinned size={14} aria-hidden="true" />
          Lieux connus
        </Link>
      </div>

      {commandes.length === 0 && fournisseurs.length === 0 ? (
        <p className="rounded-2xl border border-ink/10 bg-white px-4 py-10 text-center text-sm text-ink/50">
          Rien à afficher : aucune commande à livrer et aucun fournisseur enregistré.
        </p>
      ) : (
        <CarteLivraisons commandes={commandes} fournisseurs={fournisseurs} />
      )}
    </div>
  );
}
