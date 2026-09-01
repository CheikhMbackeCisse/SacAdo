import { getAttributsAdmin } from "@/lib/admin/attributs-actions";
import { AttributsEditor } from "@/components/admin/attributs-editor";

export default async function AdminAttributsPage() {
  const attributs = await getAttributsAdmin();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-heading text-xl font-bold text-ink">Attributs de variantes</h1>
        <p className="text-sm text-ink/50">
          La liste commune (Couleur, Taille, Poids…). Valide, renomme ou fusionne
          les attributs proposés par les vendeurs avant qu&apos;ils deviennent
          réutilisables par tous.
        </p>
      </div>
      <AttributsEditor attributs={attributs} />
    </div>
  );
}
