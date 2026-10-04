import Link from "next/link";
import { NotFoundTracker } from "@/components/trafic/not-found-tracker";

export const metadata = { title: "Page introuvable — SacAdo" };

export default function NotFound() {
  return (
    <div className="animate-fade-in-up flex flex-col items-center gap-4 px-4 py-16 text-center">
      <NotFoundTracker />
      <h1 className="font-heading text-xl font-bold text-ink">Page introuvable</h1>
      <p className="text-sm text-ink/60">
        Cette page n&apos;existe pas ou plus. Elle a peut-être changé d&apos;adresse.
      </p>
      <Link
        href="/"
        className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand"
      >
        Retour à l&apos;accueil
      </Link>
    </div>
  );
}
