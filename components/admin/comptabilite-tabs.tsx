import Link from "next/link";

const ONGLETS = [
  { cle: "tresorerie", label: "Trésorerie", href: "/admin/comptabilite" },
  { cle: "benefice", label: "Bénéfice", href: "/admin/comptabilite/benefice" },
] as const;

export function ComptabiliteTabs({ actif }: { actif: "tresorerie" | "benefice" }) {
  return (
    <div className="flex items-center gap-1 rounded-xl border border-ink/10 bg-white p-1 sm:w-fit">
      {ONGLETS.map((o) => (
        <Link
          key={o.cle}
          href={o.href}
          className={`flex min-h-9 flex-1 items-center justify-center rounded-lg px-4 text-sm font-medium transition-colors sm:flex-none ${
            actif === o.cle ? "bg-brand text-on-brand" : "text-ink/60 hover:bg-ink/5"
          }`}
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}
