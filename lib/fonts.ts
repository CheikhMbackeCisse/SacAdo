import { Nunito_Sans, Rubik } from "next/font/google";

// Instances de police partagées entre le layout storefront et le layout
// admin (chacun est un "root layout" indépendant depuis le Lot 6 — voir
// app/(storefront)/layout.tsx et app/admin/layout.tsx).
export const bodyFont = Nunito_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const headingFont = Rubik({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});
