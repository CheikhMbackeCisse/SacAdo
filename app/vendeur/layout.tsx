import type { Metadata } from "next";
import "../globals.css";
import { bodyFont, headingFont } from "@/lib/fonts";

export const metadata: Metadata = {
  title: "Espace vendeur — SacAdo",
  robots: { index: false, follow: false },
};

// Troisième root layout indépendant (voir app/(storefront)/layout.tsx et
// app/admin/layout.tsx) : ni Header ni BottomNav. Le proxy protège /vendeur/*.
export default function VendeurLayout({ children }: { children: React.ReactNode }) {
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
