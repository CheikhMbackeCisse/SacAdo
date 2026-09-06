import type { Metadata } from "next";
import "../globals.css";
import { bodyFont, headingFont } from "@/lib/fonts";

export const metadata: Metadata = {
  title: "Bon de préparation — SacAdo",
  robots: { index: false, follow: false },
};

// Root layout indépendant (comme app/vendeur/layout.tsx) : pas de header ni de
// bottom nav. Page accessible par lien signé, pensée pour être lue et imprimée.
export default function PreparationLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="fr"
      data-theme="light"
      className={`${bodyFont.variable} ${headingFont.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[#FEFDFF] text-[#001314]">{children}</body>
    </html>
  );
}
