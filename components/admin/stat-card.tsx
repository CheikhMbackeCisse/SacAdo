import type { LucideIcon } from "lucide-react";

type StatCardProps = {
  icon: LucideIcon;
  label: string;
  value: string;
  warn?: boolean;
};

export function StatCard({ icon: Icon, label, value, warn }: StatCardProps) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-white p-4">
      <span
        className={`flex size-9 items-center justify-center rounded-full ${
          warn ? "bg-red-50 text-red-600" : "bg-brand/10 text-brand"
        }`}
      >
        <Icon size={18} aria-hidden="true" />
      </span>
      <span className="text-xs text-ink/50">{label}</span>
      <span className="text-lg font-bold text-ink">{value}</span>
    </div>
  );
}
