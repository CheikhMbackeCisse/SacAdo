import { redirect } from "next/navigation";
import Image from "next/image";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getVendeurCourant } from "@/lib/vendeur/guard";
import { ProfilForm } from "@/components/vendeur/profil-form";

export default async function VendeurProfilPage() {
  const courant = await getVendeurCourant();
  if (!courant) redirect("/vendeur/connexion");
  if (courant.vendeur) redirect("/vendeur");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <Image src="/images/bg-page-form.jpg" alt="" fill priority sizes="100vw" className="object-cover" />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(254,253,255,0.94)_0%,rgba(254,253,255,0.75)_55%,rgba(254,253,255,0.45)_100%)]"
      />
      <div className="relative z-10">
        <ProfilForm emailCompte={user?.email ?? ""} />
      </div>
    </div>
  );
}
