import { getDocumentsAdmin, getKitsPourDocuments } from "@/lib/admin/documents-actions";
import { DocumentsManager } from "@/components/admin/documents-manager";

export const dynamic = "force-dynamic";

export default async function AdminDocumentsPage() {
  const [documents, kits] = await Promise.all([getDocumentsAdmin(), getKitsPourDocuments()]);

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <div>
        <h1 className="font-heading text-xl font-bold text-ink">Notices de kits</h1>
        <p className="mt-1 text-sm text-ink/55">
          Les notices de montage des kits électroniques. Le PDF n&apos;est jamais
          public : l&apos;acheteur y accède depuis « Mes documents » une fois sa
          commande confirmée. L&apos;aperçu (photo, nombre de pages, ce qu&apos;on
          apprend, matériel nécessaire) reste visible sur la fiche produit avant achat.
        </p>
      </div>
      <DocumentsManager documents={documents} kits={kits} />
    </div>
  );
}
