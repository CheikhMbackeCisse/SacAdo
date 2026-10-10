import {
  Activity,
  BarChart3,
  BellRing,
  BookOpen,
  ClipboardList,
  FileText,
  FolderTree,
  GraduationCap,
  History,
  Landmark,
  Layers,
  LayoutDashboard,
  ListChecks,
  ListOrdered,
  Map,
  MapPin,
  MapPinned,
  Menu,
  MessageSquareText,
  Package,
  Percent,
  PackageCheck,
  PackageSearch,
  Repeat2,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  TriangleAlert,
  Truck,
  Wallet,
  Warehouse,
  Users,
} from "lucide-react";

// Les 28 onglets admin. Module neutre (pas de "use client") : importé aussi
// bien par des composants serveur (app/admin/plus/page.tsx) que client
// (AdminNav, RechercheAllerA) — faire traverser un tableau contenant des
// références de composants depuis un fichier "use client" vers un composant
// serveur plante au runtime même si le build passe, d'où ce fichier séparé.
export const LIENS = [
  { href: "/admin", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/admin/commandes", label: "Commandes", icon: ClipboardList },
  { href: "/admin/achats", label: "Fournisseurs", icon: ShoppingBag },
  { href: "/admin/trafic", label: "Trafic", icon: Activity },
  { href: "/admin/livraisons", label: "Livraisons", icon: Truck },
  { href: "/admin/preparations", label: "Préparations", icon: PackageCheck },
  { href: "/admin/produits", label: "Produits", icon: Package },
  { href: "/admin/prix-a-verifier", label: "Prix à vérifier", icon: TriangleAlert },
  { href: "/admin/editions", label: "Éditions", icon: History },
  { href: "/admin/decouvrir", label: "Accueil : À découvrir", icon: Sparkles },
  { href: "/admin/classement", label: "Classement accueil", icon: ListOrdered },
  { href: "/admin/moderation", label: "Modération vendeurs", icon: ShieldCheck },
  { href: "/admin/categories", label: "Catégories", icon: FolderTree },
  { href: "/admin/attributs", label: "Attributs", icon: SlidersHorizontal },
  { href: "/admin/synonymes", label: "Synonymes", icon: Repeat2 },
  { href: "/admin/recherches", label: "Ce que les clients cherchent", icon: PackageSearch },
  { href: "/admin/modeles", label: "Modèles de messages", icon: MessageSquareText },
  { href: "/admin/notifications", label: "Notifications", icon: BellRing },
  { href: "/admin/kits", label: "Kits", icon: GraduationCap },
  { href: "/admin/listes", label: "Listes personnalisées", icon: ListChecks },
  { href: "/admin/classes", label: "Classes", icon: Layers },
  { href: "/admin/ebooks", label: "Ebooks", icon: BookOpen },
  { href: "/admin/documents", label: "Notices de kits", icon: FileText },
  { href: "/admin/zones", label: "Groupes de livraison", icon: MapPin },
  { href: "/admin/localites", label: "Localités", icon: MapPinned },
  { href: "/admin/localites/carte", label: "Localités sur la carte", icon: Map },
  { href: "/admin/lieux-speciaux", label: "Lieux spéciaux", icon: Landmark },
  { href: "/admin/promo-express", label: "Promo express", icon: Percent },
  { href: "/admin/fournisseurs", label: "Fiches fournisseurs", icon: Warehouse },
  { href: "/admin/ventes", label: "Articles vendus", icon: BarChart3 },
  { href: "/admin/clients", label: "Clients", icon: Users },
  { href: "/admin/comptabilite", label: "Comptabilité", icon: Wallet },
] as const;

export type SectionBadge = "commandes";

// Les 5 entrées regroupées (PROMPT_ADMIN_KITS_PRODUITS.md lot 4) : sur
// téléphone (bottom nav, 5 places comptées), « Plus » ouvre /admin/plus, qui
// regroupe tout le reste par thème (Produits en première tuile, reste
// accessible par la recherche "Aller à…").
export const ENTREES_PRINCIPALES: { href: string; label: string; icon: (typeof LIENS)[number]["icon"]; section?: SectionBadge }[] = [
  { href: "/admin", label: "Accueil", icon: LayoutDashboard },
  { href: "/admin/commandes", label: "Commandes", icon: ClipboardList, section: "commandes" },
  { href: "/admin/kits", label: "Kits", icon: GraduationCap },
  { href: "/admin/trafic", label: "Trafic", icon: Activity },
  { href: "/admin/plus", label: "Plus", icon: Menu },
];

// Barre latérale desktop uniquement (PROMPT_EXPORTS_ET_CORRECTIONS.md Lot 1) :
// la place n'y est pas comptée comme sur la bottom nav mobile, donc Produits
// y figure en direct plutôt que caché dans "Plus".
export const ENTREES_PRINCIPALES_DESKTOP: typeof ENTREES_PRINCIPALES = [
  { href: "/admin", label: "Accueil", icon: LayoutDashboard },
  { href: "/admin/commandes", label: "Commandes", icon: ClipboardList, section: "commandes" },
  { href: "/admin/achats", label: "Fournisseurs", icon: ShoppingBag },
  { href: "/admin/produits", label: "Produits", icon: Package },
  { href: "/admin/kits", label: "Kits", icon: GraduationCap },
  { href: "/admin/trafic", label: "Trafic", icon: Activity },
  { href: "/admin/plus", label: "Plus", icon: Menu },
];
