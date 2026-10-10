import { notFound } from "next/navigation";
import { getListeAdmin, getListeItemsAdmin } from "@/lib/admin/listes-actions";
import { origineSite } from "@/lib/site-url";
import { ListeDetailsForm } from "@/components/admin/liste-details-form";
import { ListeStatutToggle } from "@/components/admin/liste-statut-toggle";
import { ListeItemsManager } from "@/components/admin/liste-items-manager";
import { SupprimerListeButton } from "@/components/admin/supprimer-liste-button";
import { ShareButton } from "@/components/ui/share-button";

export default async function EditListePage(props: PageProps<"/admin/listes/[id]">) {
  const { id } = await props.params;
  const listeId = Number(id);
  if (!Number.isFinite(listeId)) notFound();

  const liste = await getListeAdmin(listeId);
  if (!liste) notFound();

  const items = await getListeItemsAdmin(listeId);
  const site = await origineSite();
  const lienPublic = `${site}/liste/${liste.code}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <h1 className="font-heading text-xl font-bold text-ink">{liste.titre}</h1>
        <ListeStatutToggle listeId={liste.id} statut={liste.statut} />
      </div>

      <ListeDetailsForm listeId={liste.id} titre={liste.titre} description={liste.description} />

      <div className="flex max-w-2xl flex-wrap items-center gap-3 rounded-2xl border border-ink/10 bg-white px-5 py-3 text-sm">
        <span className="font-semibold text-ink">Lien public :</span>
        <a href={lienPublic} target="_blank" rel="noreferrer" className="truncate text-brand hover:underline">
          {lienPublic}
        </a>
        <ShareButton
          path={`/liste/${liste.code}`}
          title={liste.titre}
          className="flex size-8 shrink-0 items-center justify-center rounded-full border border-ink/15 text-ink/70 transition-transform active:scale-90"
          size={15}
        />
        {liste.statut !== "publie" && (
          <span className="text-xs text-amber-600">Masquée : le lien n&apos;est pas encore accessible.</span>
        )}
      </div>

      <ListeItemsManager listeId={liste.id} items={items} />

      <SupprimerListeButton listeId={liste.id} titre={liste.titre} />
    </div>
  );
}
