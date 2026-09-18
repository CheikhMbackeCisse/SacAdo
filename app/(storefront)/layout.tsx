import type { Metadata, Viewport } from "next";
import "../globals.css";
import "../../styles/app-feel.css";
import { bodyFont, headingFont } from "@/lib/fonts";
import { AppBehavior } from "@/components/pwa/app-behavior";
import { Header } from "@/components/layout/header";
import { AppMain } from "@/components/layout/app-main";
import { CartToast } from "@/components/panier/cart-toast";
import { BottomNav } from "@/components/layout/bottom-nav";
import { WelcomeScreen } from "@/components/onboarding/welcome-screen";
import { NavigationGuardProvider } from "@/components/ui/navigation-guard";
import { InstallBanner } from "@/components/pwa/install-banner";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { SplashScreen } from "@/components/pwa/splash-screen";
import { JsonLd, organizationJsonLd, websiteJsonLd } from "@/lib/seo/jsonld";
import { WHATSAPP_NUMERO } from "@/lib/whatsapp";

// Même règle que lib/site-url.ts (utilisée côté serveur pour les liens de
// messages) : variable d'environnement, repli sur le domaine de prod — jamais
// une URL en dur sans échappatoire. metadataBase doit être une valeur connue
// à l'évaluation du module (pas de requête entrante ici), d'où le repli fixe
// plutôt que la détection par en-tête `host` de origineSite().
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://sacado.sn").replace(/\/$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
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
  // Android détecte sinon tout seul les numéros affichés (profil, assistance) et
  // propose de les appeler. On coupe la détection partout : tout numéro qui doit
  // rester appelable est écrit explicitement en <a href="tel:…">.
  formatDetection: {
    telephone: false,
    date: false,
    address: false,
    email: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FEFDFF" },
    { media: "(prefers-color-scheme: dark)", color: "#0E0843" },
  ],
  viewportFit: "cover",
};

// Appliqué avant le premier paint pour éviter un flash de thème clair chez les
// visiteurs ayant choisi "sombre" (ou "clair" alors que l'OS est en sombre).
// Le mode "système" ne pose aucun attribut : la media query de globals.css gère.
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('sacado_theme');if(t==='sombre')document.documentElement.setAttribute('data-theme','dark');else if(t==='clair')document.documentElement.setAttribute('data-theme','light');}catch(e){}})();`;

// Même principe pour la taille de texte (Préférences > Affichage) : la classe
// doit être posée avant l'hydratation, sinon l'app clignote en taille normale.
const TAILLE_TEXTE_SCRIPT = `(function(){try{var t=localStorage.getItem('sacado_taille_texte');if(t==='grande')document.documentElement.classList.add('taille-grande');else if(t==='tres_grande')document.documentElement.classList.add('taille-tres-grande');}catch(e){}})();`;

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
        <JsonLd data={organizationJsonLd({ siteUrl: SITE_URL, whatsappE164: `+${WHATSAPP_NUMERO}` })} />
        <JsonLd data={websiteJsonLd({ siteUrl: SITE_URL })} />
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: TAILLE_TEXTE_SCRIPT }} />
        <SplashScreen />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-on-brand"
        >
          Aller au contenu principal
        </a>
        <AppBehavior />
        <Header />
        <CartToast />
        <AppMain>
          <NavigationGuardProvider>{children}</NavigationGuardProvider>
        </AppMain>
        <BottomNav />
        <WelcomeScreen />
        <InstallBanner />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
