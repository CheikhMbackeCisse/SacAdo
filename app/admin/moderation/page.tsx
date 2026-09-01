import { getFileNegociation, getToursMaxActuel } from "@/lib/admin/negociation-actions";
import { FileModeration } from "@/components/admin/file-moderation";
import { ReglageToursMax } from "@/components/admin/reglage-tours-max";

export default async function AdminModerationPage() {
  const [items, toursMax] = await Promise.all([getFileNegociation(), getToursMaxActuel()]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-heading text-xl font-bold text-ink">Modération vendeurs</h1>
        <p className="mt-1 text-sm text-ink/55">
          Produits vendeurs en attente d&apos;une décision : publier au prix proposé,
          contre-proposer un autre prix, ou refuser.
        </p>
      </div>

      <ReglageToursMax valeur={toursMax} />

      <FileModeration items={items} />
    </div>
  );
}
