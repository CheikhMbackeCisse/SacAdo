import type { LucideIcon } from "lucide-react";

type ComingSoonProps = {
  icon: LucideIcon;
  title: string;
  description: string;
};

export function ComingSoon({ icon: Icon, title, description }: ComingSoonProps) {
  return (
    <div className="animate-fade-in-up flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-brand/10 text-brand">
        <Icon size={28} aria-hidden="true" />
      </div>
      <h1 className="font-heading text-xl font-semibold text-ink">{title}</h1>
      <p className="max-w-xs text-sm text-ink/60">{description}</p>
    </div>
  );
}
