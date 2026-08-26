import type { LucideIcon } from "lucide-react";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
};

// État vide générique (icône + titre + description courte), pour garder le
// même style partout où une liste peut être vide (Lot 7 : "états vides propres").
export function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-brand/10 text-brand">
        <Icon size={26} aria-hidden="true" />
      </span>
      <h2 className="font-heading text-base font-semibold text-ink">{title}</h2>
      {description && <p className="max-w-xs text-sm text-ink/60">{description}</p>}
    </div>
  );
}
