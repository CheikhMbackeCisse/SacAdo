import { getLieuxSpeciauxAdmin } from "@/lib/admin/lieux-speciaux-actions";
import { LieuxSpeciauxEditor } from "@/components/admin/lieux-speciaux-editor";

export const dynamic = "force-dynamic";

export default async function AdminLieuxSpeciauxPage() {
  const lieux = await getLieuxSpeciauxAdmin();

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div>
        <h1 className="font-heading text-xl font-bold text-ink">Lieux spéciaux</h1>
        <p className="mt-1 text-sm text-ink/55">
          Cas particuliers avec leur propre tarif et leur propre mode (retrait, livraison
          dédiée, ou tarif à confirmer), en dehors des groupes de livraison.
        </p>
      </div>
      <LieuxSpeciauxEditor lieux={lieux} />
    </div>
  );
}
