import { BellRing, ShieldOff, TriangleAlert } from "lucide-react";
import { getStatsNotifications } from "@/lib/admin/notifications-actions";
import { LIBELLE_CANAL } from "@/lib/messages/modeles";
import { StatCard } from "@/components/admin/stat-card";

export const dynamic = "force-dynamic";

function formatPourcent(n: number | null): string {
  if (n === null) return "—";
  return `${Math.round(n * 100)}%`;
}

export default async function AdminNotificationsPage() {
  const stats = await getStatsNotifications();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-heading text-xl font-bold text-ink">Notifications</h1>
        <p className="mt-1 text-sm text-ink/55">
          Sept derniers jours. Un taux d&apos;échec push qui grimpe signale des abonnements
          morts non nettoyés.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard
          icon={BellRing}
          label="Taux d'échec push"
          value={formatPourcent(stats.tauxEchecPush)}
          warn={(stats.tauxEchecPush ?? 0) > 0.1}
        />
        <StatCard
          icon={ShieldOff}
          label="Bloqués par préférence"
          value={String(stats.totalBloquePreference)}
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-ink/10 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-left text-xs text-ink/50">
              <th className="px-4 py-3 font-medium">Canal</th>
              <th className="px-4 py-3 font-medium">Envoyés</th>
              <th className="px-4 py-3 font-medium">Échecs</th>
              <th className="px-4 py-3 font-medium">Différés</th>
              <th className="px-4 py-3 font-medium">Bloqués (préférence)</th>
            </tr>
          </thead>
          <tbody>
            {stats.parCanal.map((c) => (
              <tr key={c.canal} className="border-b border-ink/5 last:border-0">
                <td className="px-4 py-3 font-medium text-ink">{LIBELLE_CANAL[c.canal]}</td>
                <td className="px-4 py-3 text-ink/70">{c.envoye}</td>
                <td className={`px-4 py-3 ${c.echec > 0 ? "font-medium text-red-600" : "text-ink/70"}`}>
                  {c.echec}
                </td>
                <td className="px-4 py-3 text-ink/70">{c.differe}</td>
                <td className="px-4 py-3 text-ink/70">{c.bloque_preference}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {stats.parCanal.every((c) => c.envoye + c.echec + c.differe + c.bloque_preference === 0) && (
        <p className="flex items-center gap-2 rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink/55">
          <TriangleAlert size={15} className="shrink-0 text-ink/40" aria-hidden="true" />
          Aucune notification journalisée sur les 7 derniers jours.
        </p>
      )}
    </div>
  );
}
