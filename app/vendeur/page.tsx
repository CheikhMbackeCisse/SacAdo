import { LogOut, PackagePlus, Wallet } from "lucide-react";
import { requireVendeur } from "@/lib/vendeur/guard";
import { signOutVendeur } from "@/lib/vendeur/auth-actions";

export default async function VendeurDashboardPage() {
  const { vendeur } = await requireVendeur();

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#001314]/50">Espace vendeur</p>
          <h1 className="font-heading text-xl font-bold text-[#001314]">{vendeur.nom_boutique}</h1>
        </div>
        <form action={signOutVendeur}>
          <button
            type="submit"
            className="flex items-center gap-2 rounded-full border border-[#001314]/15 px-3 py-1.5 text-xs font-medium text-[#001314]/70 transition-colors hover:bg-[#001314]/[0.03]"
          >
            <LogOut size={14} aria-hidden="true" />
            Se déconnecter
          </button>
        </form>
      </header>

      <div className="rounded-2xl border border-[#001314]/10 bg-white p-5">
        <p className="text-sm text-[#001314]/80">
          Bienvenue&nbsp;! Votre compte vendeur est actif. La gestion de vos produits et le
          suivi de vos ventes arriveront très bientôt.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {[
          { icon: PackagePlus, titre: "Mes produits", texte: "Ajoutez vos articles, SacAdo les valide avant publication." },
          { icon: Wallet, titre: "Mes ventes & reversements", texte: "Suivez ce qui est vendu et ce qui vous sera reversé." },
        ].map(({ icon: Icon, titre, texte }) => (
          <div key={titre} className="rounded-2xl border border-dashed border-[#001314]/15 bg-white/60 p-4">
            <Icon size={18} className="text-[#001314]/40" aria-hidden="true" />
            <p className="mt-2 text-sm font-semibold text-[#001314]">{titre}</p>
            <p className="mt-0.5 text-xs text-[#001314]/55">{texte}</p>
            <span className="mt-2 inline-block rounded-full bg-[#001314]/[0.06] px-2 py-0.5 text-[11px] font-medium text-[#001314]/50">
              Bientôt
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
