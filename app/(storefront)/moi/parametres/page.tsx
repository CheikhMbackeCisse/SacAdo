"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useIdentite } from "@/lib/local/identite";

export default function ParametresPage() {
  const router = useRouter();
  const { identite, oublier } = useIdentite();

  return (
    <div className="animate-fade-in-up flex flex-col gap-5 px-4 py-4">
      <h1 className="font-heading text-xl font-bold text-ink">Paramètres</h1>

      <section className="flex flex-col divide-y divide-ink/10 rounded-2xl border border-ink/10 bg-white">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-ink">Langue</span>
          <span className="text-xs text-ink/50">Français</span>
        </div>
        <div className="flex flex-col gap-0.5 px-4 py-3">
          <span className="text-sm text-ink">Compte</span>
          <span className="text-xs text-ink/50">
            {identite
              ? `${identite.nom || "—"} · ${identite.telephone}`
              : "Aucune commande enregistrée sur cet appareil"}
          </span>
        </div>
        <Link href="/politique-confidentialite" className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-ink">Confidentialité</span>
          <span className="text-xs text-brand">Voir la politique →</span>
        </Link>
      </section>

      {identite && (
        <button
          type="button"
          onClick={() => {
            oublier();
            router.push("/moi");
          }}
          className="self-start rounded-full border border-ink/15 px-4 py-2 text-sm font-medium text-ink transition-colors active:scale-95"
        >
          Se déconnecter
        </button>
      )}
    </div>
  );
}
