# DetailDesk

**Ton lien de réservation pro pour le detailing, avec acompte, rappels et historique client.**

SaaS multi-tenant de réservation pour auto detailers, mobile detailers et petits centres de detailing. Un pro crée son compte, configure ses services, connecte son Stripe, et partage son lien public `/b/son-slug` — ses clients réservent et paient un acompte directement sur SON compte Stripe.

---

## 1. Stack

- **Next.js 15** (App Router, TypeScript, Server Actions, output standalone)
- **Tailwind CSS** + composants UI style shadcn
- **Supabase** — Auth, Postgres, **RLS** (sécurité multi-tenant au niveau base)
- **Stripe Connect Express** — un compte Stripe connecté par business
- **Resend** — emails transactionnels (welcome, confirmation, paiement, rappel, annulation)
- **Zod** validation, **date-fns**
- **Railway** — déploiement via push GitHub

**Pourquoi pas de Prisma/Drizzle ?** Le multi-tenant repose sur les policies RLS Postgres. `supabase-js` exécute chaque requête dashboard avec le JWT de l'utilisateur, donc RLS s'applique automatiquement. Un ORM en connexion directe contournerait RLS et affaiblirait la garantie de sécurité. Migrations = SQL brut versionné dans `supabase/migrations/`.

## 2. Architecture

```
src/
  app/
    page.tsx                 # landing
    (auth)/                  # login, signup, reset/update password (+ actions)
    auth/callback/           # échange code Supabase (confirmation email, reset)
    onboarding/              # création du business après signup
    dashboard/               # espace pro (protégé, RLS via session utilisateur)
      services/ customers/ bookings/ availability/ settings/
      actions.ts             # toutes les mutations métier (Server Actions)
    b/[slug]/                # page publique de réservation (service-role, scoped par slug)
      confirmed/[bookingId]/ # page de confirmation
    cancel/[token]/          # annulation client via token sécurisé
    admin/                   # espace platform_admin (stats, businesses, users, bookings)
    api/
      health/                # healthcheck Railway
      webhooks/stripe/         # webhook compte plateforme
      webhooks/stripe-connect/ # webhook comptes connectés (checkout, account.updated)
      cron/reminders/          # rappels 24h avant (protégé par CRON_SECRET)
  lib/
    supabase/ (client, server, admin)   auth.ts   stripe.ts
    mailer.ts  emails.ts  slots.ts  validators.ts  utils.ts
  middleware.ts              # refresh session + garde /dashboard /admin /onboarding
supabase/migrations/0001_schema.sql    # schéma complet + RLS + indexes + triggers
scripts/seed.mjs                       # données de démo
```

### Multi-tenant — modèle de sécurité

1. Chaque table métier a `business_id NOT NULL` + index.
2. **RLS activé sur toutes les tables**, policies créées dans la même migration : accès uniquement si `is_business_member(business_id)` (membership vérifié en base, `SECURITY DEFINER`).
3. Le dashboard utilise le client Supabase **lié à la session** → RLS s'applique à chaque requête. `business_id` n'est **jamais** lu depuis le client : il vient du membership serveur (`requireBusiness()`).
4. La page publique et les webhooks utilisent le client **service-role**, uniquement côté serveur, avec des requêtes explicitement scopées (slug, token unique, metadata Stripe signée).
5. `platform_admin` : lecture globale via policies dédiées + `requirePlatformAdmin()` côté serveur.

### Paiements — Stripe Connect

- DetailDesk possède **un compte plateforme** (les clés du `.env`).
- Chaque business connecte **son propre compte Stripe Express** (onboarding depuis Réglages).
- Les acomptes sont créés via Checkout **sur le compte connecté** (`{ stripeAccount }`) → l'argent va au pro, pas à la plateforme.
- 0 commission en V1 ; le champ `application_fee_cents` et la structure sont prêts pour une commission V2 (`application_fee_amount` dans la Checkout Session).
- Les acomptes sont automatiquement désactivés sur la page publique tant que Stripe n'est pas connecté (`charges_enabled`).

## 3. Setup local

```bash
git clone https://github.com/qrDOTtech1/DetailDesk.git
cd DetailDesk
npm install
cp .env.example .env    # puis remplis les valeurs (voir ci-dessous)
npm run dev
```

### 3a. Supabase

1. Crée un projet sur [supabase.com](https://supabase.com).
2. Colle le contenu de `supabase/migrations/0001_schema.sql` dans **SQL Editor** et exécute.
3. Récupère dans *Settings → API* : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
4. *Authentication → URL Configuration* : ajoute `http://localhost:3000/auth/callback` (puis l'URL Railway en prod) aux Redirect URLs.
5. (Optionnel dev) *Authentication → Providers → Email* : désactive "Confirm email" pour un onboarding instantané.

### 3b. Stripe Connect

1. Compte Stripe (mode **test** d'abord) → active **Connect** avec des comptes **Express**.
2. `STRIPE_SECRET_KEY` + `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` = clés de la plateforme.
3. Webhooks (*Developers → Webhooks*) :
   - Endpoint **compte** : `https://<app>/api/webhooks/stripe` — événement `account.updated` → `STRIPE_WEBHOOK_SECRET`.
   - Endpoint **Connect** ("Listen to events on **connected accounts**") : `https://<app>/api/webhooks/stripe-connect` — événements `checkout.session.completed`, `checkout.session.expired`, `payment_intent.payment_failed`, `account.updated` → `STRIPE_CONNECT_WEBHOOK_SECRET`.
4. En local : `stripe listen --forward-connect-to localhost:3000/api/webhooks/stripe-connect`.

### 3c. Resend

1. Crée un compte [resend.com](https://resend.com) → `RESEND_API_KEY`.
2. Dev : `RESEND_FROM_EMAIL=DetailDesk <onboarding@resend.dev>` fonctionne sans domaine (envoi vers ton propre email uniquement).
3. Prod : vérifie ton domaine dans Resend et utilise `DetailDesk <bookings@tondomaine.com>`.
4. Sans `RESEND_API_KEY`, les emails sont simplement loggés en console + en base (`email_logs`) — les flux ne cassent jamais.

### 3d. Seed de démo

```bash
npm run db:seed
```

Crée : `admin@detaildesk.demo` (platform admin), `owner@detaildesk.demo` (owner du business démo "Shine Detailing", flag test), 3 services, 3 clients, 3 véhicules, 5 réservations, 2 paiements. Mot de passe des deux comptes : `detaildesk-demo-2026`. Page publique : `/b/shine-demo`.

## 4. Déploiement Railway

1. Push le repo sur GitHub.
2. Railway → **New Project → Deploy from GitHub repo** → sélectionne `DetailDesk`. Railway détecte Next.js (Nixpacks) ; `railway.json` fournit build/start/healthcheck (`/api/health`).
3. Renseigne **toutes** les variables du `.env.example` dans *Variables* (avec `NEXT_PUBLIC_APP_URL=https://<ton-domaine-railway>` et `APP_ENV=production`).
4. Chaque `git push` sur `main` → **redeploy automatique**.
5. **Cron des rappels** : Railway → nouveau service "Cron" (ou un cron externe type cron-job.org) qui appelle chaque heure :
   ```
   curl -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/cron/reminders
   ```
6. Mets à jour les URLs de redirect Supabase et les endpoints webhooks Stripe avec le domaine de prod.

## 5. Rôle platform admin

Les emails listés dans `PLATFORM_ADMIN_EMAILS` reçoivent `platform_role = 'platform_admin'` à l'inscription. Un admin accède à `/admin` : stats globales, liste des businesses (flag test/internal, activation), users, bookings. Pour promouvoir un compte existant : `update profiles set platform_role = 'platform_admin' where email = '...';`

## 6. Limites V1

- 1 business par utilisateur (le schéma supporte déjà plusieurs memberships).
- Rôle `staff` présent en base mais sans invitation UI.
- Slug non modifiable après création.
- Pas de refunds automatiques (structure `payments` prête).
- Logo par URL (pas d'upload de fichier).
- Vue liste des réservations (pas de calendrier drag & drop).
- Annulation publique : pas de remboursement auto de l'acompte.

## 7. Roadmap V2

- Comptes staff + invitations
- Rappels WhatsApp / SMS
- Sync Google Calendar
- Galerie avant/après
- Factures PDF
- Codes promo
- **Commission plateforme** (`application_fee_amount` — champ déjà en base)
- Analytics enrichies
- White-label
- Abonnements / packs d'entretien

## 8. Troubleshooting

| Problème | Cause probable |
|---|---|
| Redirigé vers /login en boucle | Cookies Supabase : vérifie URL/ANON_KEY et les Redirect URLs Supabase |
| "Ce créneau n'est plus disponible" | Créneau pris entre-temps, préavis (`booking_notice_hours`) ou période bloquée |
| Acompte non proposé sur la page publique | Stripe pas connecté (`charges_enabled` false) → Réglages → Vérifier le statut |
| Paiement OK mais réservation "en attente" | Webhook Connect non configuré ou mauvais `STRIPE_CONNECT_WEBHOOK_SECRET` |
| Emails non reçus | Regarde `email_logs` (statut) ; en dev Resend n'envoie qu'à ton propre email sans domaine vérifié |
| Build Railway OK mais crash au démarrage | Variable d'environnement manquante — compare avec `.env.example` |
