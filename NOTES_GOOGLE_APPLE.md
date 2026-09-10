# Écran de consentement Google & connexion Apple

Deux points du lot de corrections qui relèvent de la **configuration** (consoles
externes, options payantes), pas du code applicatif. Rien à déployer ici.

---

## 1. Écran de consentement Google (point 6)

### Le symptôme

À la connexion Google (côté vendeur / admin), l'écran affiche que
`yeklnsguhcmlinnufaog.supabase.co` souhaite accéder au compte Google. C'est
l'adresse technique du projet Supabase.

### Pourquoi

Google affiche le domaine de **l'adresse de rappel** (redirect URI) de
l'authentification. Tant que cette adresse pointe vers `*.supabase.co`, c'est ce
domaine qui apparaît. **Aucune modification du code applicatif ne change ce
comportement** — c'est purement une affaire de configuration OAuth + domaine.

### Ce qui n'est PAS possible

Renommer `yeklnsguhcmlinnufaog.supabase.co` en `sacado.supabase.co` ou autre :
`yeklnsguhcmlinnufaog` est la **référence du projet Supabase**, un identifiant
fixe. Supabase ne permet pas de choisir un sous-domaine `*.supabase.co`.

### DÉCISION : on fait l'option gratuite (nom + logo)

Le gros titre de l'écran Google devient « **SacAdo** souhaite accéder… » avec le
logo. Le domaine technique reste, mais en petit, en dessous — la plupart des
gens ne le lisent pas. Le domaine personnalisé payant (ci-dessous) est reporté.

#### Étapes — Console Google Cloud

1. `console.cloud.google.com` → sélectionner **le projet** relié à la connexion
   Google de Supabase (celui dont l'ID client OAuth est configuré dans Supabase
   → Authentication → Providers → Google).
2. Menu → **APIs et services → Écran de consentement OAuth** (dans la nouvelle
   console : **Google Auth Platform → Branding**).
3. Renseigner :
   - **Nom de l'application** : `SacAdo`
   - **Logo** : `public/images/logo.jpg` (cartable sur fond blanc, carré, < 1 Mo)
   - **E-mail d'assistance utilisateur**
   - **Page d'accueil de l'application** : `https://sacadosn.vercel.app`
   - **Lien politique de confidentialité** :
     `https://sacadosn.vercel.app/politique-confidentialite`
   - **Lien conditions d'utilisation** : à créer (ou pointer vers la politique
     de confidentialité en attendant)
   - **Domaines autorisés** : `vercel.app` (et `sacado.sn` le jour où le domaine
     perso est branché)
   - **E-mail de contact du développeur**
4. **Enregistrer**.

#### À savoir

- Ajouter un **logo** peut déclencher une **vérification Google** (bandeau
  « application non vérifiée » tant que ce n'est pas fait). Prévoir plusieurs
  jours. Le nom, lui, s'applique tout de suite.
- Sans le domaine personnalisé (étape reportée), le domaine `*.supabase.co`
  reste visible en petit sous le nom. C'est le comportement attendu.

### Reporté : domaine personnalisé Supabase (payant)

À faire seulement si le petit domaine technique reste gênant après l'option
gratuite. Option **Custom Domain** de Supabase (~10 $/mois) → `auth.sacado.sn` :

- Configurer sur le projet Supabase (Authentication → URL Configuration →
  Custom domain).
- Remplacer l'adresse de rappel dans la console Google
  (`Authorized redirect URIs`) par `https://auth.sacado.sn/auth/v1/callback`.
- Ajouter `sacado.sn` aux domaines autorisés Google.

---

## 2. Connexion Apple sur l'espace vendeur (point 7)

### Demandée, mais à arbitrer — elle a un coût

- Exige un **compte développeur Apple** : **99 USD / an**.
- Demande de créer un identifiant de service (Service ID), une clé de signature
  (Sign in with Apple key), et de configurer le fournisseur Apple dans Supabase.
- N'est **obligatoire** que pour une application publiée sur l'App Store qui
  propose déjà d'autres connexions tierces (Google, etc.). **SacAdo est une
  application web (PWA), elle n'est donc pas concernée par cette obligation.**
- Le public visé — vendeurs et fournisseurs dakarois — est très majoritairement
  sur **Android**.

### Recommandation

**Reporter après le lancement.** N'engager les 99 USD que si un vendeur le
demande réellement.

Si la décision est de le faire quand même : le traiter **en dernier**, après
tout le reste.
