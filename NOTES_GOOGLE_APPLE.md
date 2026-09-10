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

### Ce qu'il faut faire

1. **Console Google Cloud → écran de consentement OAuth**
   - Nom de l'application : `SacAdo`
   - Logo de l'application (192×192 minimum, PNG)
   - Adresse e-mail d'assistance
   - Lien vers la politique de confidentialité : `https://<domaine>/politique-confidentialite`
   - Lien vers les conditions d'utilisation
   - Domaine(s) autorisé(s) de l'application

2. **Domaine personnalisé Supabase** (⚠️ décision à valider avec Cheikh)
   - Configurer un domaine du type `auth.sacado.sn` sur le projet Supabase
     (Authentication → URL Configuration → Custom domain).
   - **C'est une option PAYANTE de Supabase** (Custom Domain add-on). À valider
     avant engagement.
   - Une fois en place : remplacer l'adresse de rappel dans la console Google
     (`Authorized redirect URIs`) par celle de ce domaine
     (`https://auth.sacado.sn/auth/v1/callback`).
   - Ajouter `auth.sacado.sn` dans les domaines autorisés de la console Google.

3. **Vérification Google**
   - Pour afficher un logo et sortir du « mode test » (bandeau
     « application non vérifiée »), Google peut exiger une vérification.
   - Prévoir **plusieurs jours** de délai.

### Important

Sans l'étape 2 (domaine personnalisé), le **nom** de l'application changera sur
l'écran Google, mais le **domaine** `*.supabase.co` restera visible. Les deux
étapes vont ensemble.

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
