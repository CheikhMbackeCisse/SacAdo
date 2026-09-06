import { getEbooksAdmin } from "@/lib/admin/ebooks-actions";
import { EbooksManager } from "@/components/admin/ebooks-manager";

export const dynamic = "force-dynamic";

export default async function AdminEbooksPage() {
  const ebooks = await getEbooksAdmin();

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <div>
        <h1 className="font-heading text-xl font-bold text-ink">Ebooks offerts</h1>
        <p className="mt-1 text-sm text-ink/55">
          Le guide de réussite offert à l&apos;achat d&apos;un kit. Un PDF par classe
          (ou un générique partagé entre plusieurs classes). Les fichiers ne sont
          jamais publics : l&apos;acheteur y accède depuis « Mes commandes ».
        </p>
      </div>
      <EbooksManager ebooks={ebooks} />
    </div>
  );
}
