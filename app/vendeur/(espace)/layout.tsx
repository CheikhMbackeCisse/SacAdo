import { requireVendeur } from "@/lib/vendeur/guard";
import { getNbMessagesNonLus } from "@/lib/vendeur/messages-actions";
import { VendeurShell } from "@/components/vendeur/vendeur-shell";

// Layout de l'espace vendeur connecté (tableau de bord, produits, ventes).
// Les pages de connexion / profil / callback vivent hors de ce groupe et
// n'ont donc pas la barre de navigation.
export default async function EspaceVendeurLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { vendeur } = await requireVendeur();
  const nbMessagesNonLus = await getNbMessagesNonLus();
  return (
    <VendeurShell nomBoutique={vendeur.nom_boutique} nbMessagesNonLus={nbMessagesNonLus}>
      {children}
    </VendeurShell>
  );
}
