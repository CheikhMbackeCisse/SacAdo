import type { Metadata, Viewport } from "next";
import "../globals.css";
import { bodyFont, headingFont } from "@/lib/fonts";
import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { WelcomeScreen } from "@/components/onboarding/welcome-screen";
import { InstallBanner } from "@/components/pwa/install-banner";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { SplashScreen } from "@/components/pwa/splash-screen";

export const metadata: Metadata = {
  title: "SacAdo — Fournitures scolaires au Sénégal",
  description:
    "Kits scolaires et fournitures d'étude, livrés partout au Sénégal.",
  // iOS ne lit pas le manifest.json pour l'icône "Ajouter à l'écran d'accueil" :
  // il lui faut ce lien apple-touch-icon dédié.
  icons: {
    apple: "/images/logo.jpg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SacAdo",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FEFDFF" },
    { media: "(prefers-color-scheme: dark)", color: "#02296C" },
  ],
  viewportFit: "cover",
};

// Appliqué avant le premier paint pour éviter un flash de thème clair chez les
// visiteurs ayant choisi "sombre" (ou "clair" alors que l'OS est en sombre).
// Le mode "système" ne pose aucun attribut : la media query de globals.css gère.
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('sacado_theme');if(t==='sombre')document.documentElement.setAttribute('data-theme','dark');else if(t==='clair')document.documentElement.setAttribute('data-theme','light');}catch(e){}})();`;

// Root layout du site client (voir app/admin/layout.tsx pour le back-office,
// qui est un second root layout indépendant — pas de Header/BottomNav là-bas).
export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${bodyFont.variable} ${headingFont.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-surface text-ink">
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <SplashScreen />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-on-brand"
        >
          Aller au contenu principal
        </a>
        <Header />
        <main
          id="main-content"
          className="mx-auto flex w-full max-w-6xl flex-1 flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0"
        >
          {children}
        </main>
        <BottomNav />
        <WelcomeScreen />
        <InstallBanner />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
