import { getModelesAdmin } from "@/lib/admin/modeles-actions";
import { ModelesEditor } from "@/components/admin/modeles-editor";

export const dynamic = "force-dynamic";

export default async function AdminModelesPage() {
  const modeles = await getModelesAdmin();

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div>
        <h1 className="font-heading text-xl font-bold text-ink">Modèles de messages</h1>
        <p className="mt-1 text-sm text-ink/55">
          Le texte des messages envoyés aux clients — WhatsApp, notifications push et boîte de
          réception. Toute modification s&apos;applique immédiatement, sans redéploiement. Le ton
          tutoie, comme le reste de l&apos;application.
        </p>
      </div>
      <ModelesEditor modeles={modeles} />
    </div>
  );
}
