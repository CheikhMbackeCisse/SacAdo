import Link from "next/link";
import { getKitsAdmin } from "@/lib/admin/kits-actions";
import { NouveauKitForm } from "@/components/admin/nouveau-kit-form";

const LABELS_CYCLE: Record<string, string> = {
  prescolaire: "Préscolaire",
  elementaire: "Élémentaire",
  college: "Collège",
  lycee: "Lycée",
};

export default async function AdminKitsPage() {
  const kits = await getKitsAdmin();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-xl font-bold text-ink">Kits</h1>

      <NouveauKitForm />

      <div className="overflow-x-auto rounded-2xl border border-ink/10 bg-white">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-left text-xs text-ink/50">
              <th className="px-4 py-3 font-medium">Nom</th>
              <th className="px-4 py-3 font-medium">Cycle</th>
              <th className="px-4 py-3 font-medium">Niveau</th>
              <th className="px-4 py-3 font-medium">Articles</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {kits.map((kit) => (
              <tr key={kit.id} className="border-b border-ink/5 last:border-0">
                <td className="px-4 py-3 text-ink">{kit.nom}</td>
                <td className="px-4 py-3 text-ink/60">{LABELS_CYCLE[kit.cycle]}</td>
                <td className="px-4 py-3 text-ink/60">{kit.niveau}</td>
                <td className="px-4 py-3 text-ink/60">{kit.nb_items}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/kits/${kit.id}`} className="text-brand hover:underline">
                    Gérer les articles
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
