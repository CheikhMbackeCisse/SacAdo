import { getLivraisons } from "@/lib/admin/livraisons-actions";
import { getFournisseurs } from "@/lib/admin/fournisseurs-actions";
import { CarteLivraisons } from "@/components/admin/carte-livraisons";

export const dynamic = "force-dynamic";

export default async function AdminLivraisonsPage() {
  const [commandes, fournisseurs] = await Promise.all([getLivraisons(), getFournisseurs()]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-heading text-xl font-bold text-ink">Livraisons</h1>
        <p className="mt-1 text-sm text-ink/55">
          Commandes à livrer et points de retrait, pour organiser les tournées. Une
          commande disparaît de la carte dès qu&apos;elle est marquée « livrée ».
        </p>
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
