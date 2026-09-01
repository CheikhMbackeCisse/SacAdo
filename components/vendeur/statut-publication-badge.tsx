import type { StatutPublication } from "@/lib/supabase/types";

const CONFIG: Record<StatutPublication, { label: string; className: string }> = {
  en_attente: { label: "En attente de validation", className: "bg-[#E07B39]/12 text-[#8a4a1f]" },
  negociation: { label: "Négociation en cours", className: "bg-[#0B3D91]/10 text-[#0B3D91]" },
  publie: { label: "Publié", className: "bg-[#16A34A]/12 text-[#166534]" },
  refuse: { label: "Refusé", className: "bg-red-100 text-red-700" },
};

export function StatutPublicationBadge({ statut }: { statut: StatutPublication }) {
  const { label, className } = CONFIG[statut];
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${className}`}>
      {label}
    </span>
  );
}
