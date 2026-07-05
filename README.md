# DetailDesk

**Ton lien de réservation pro pour le detailing, avec acompte, rappels et historique client.**

SaaS multi-tenant de réservation pour auto detailers, mobile detailers et petits centres de detailing. Un pro crée son compte, configure ses services, connecte son Stripe, et partage son lien public `/b/son-slug` — ses clients réservent et paient un acompte directement sur SON compte Stripe.

---

## 1. Stack

- **Next.js 15** (App Router, TypeScript, Server Actions, output standalone)
- **Tailwind CSS** + composants UI style shadcn
- **Railway Postgres** + **Prisma** — base de données et migrations
- **Auth maison** — session signée (JWT `HS256` via `jose`) en cookie httpOnly + mots de passe hashés (`bcryptjs`)
- **Stripe Connect Express** — un compte Stripe connecté par business
- **Resend** — emails transactionnels (welcome, confirmation, paiement, rappel, annulation)
- **Zod** validation, **date-fns**
- **Railway** — hébergement de l'app + base, déploiement via push GitHub

**Pourquoi une auth maison et pas Auth.js/Supabase ?** Le projet tourne entièrement sur Railway (app + Postgres), sans service d'auth managé. La couche session est volontairement petite et lisible : un cookie signé (`src/lib/session.ts`) + vérifications explicites de membership à chaque requête (`src/lib/auth.ts`, `requireBusiness()`), plutôt qu'une dépendance externe à configurer.

## 2. Architecture

```
src/
  app/
    page.tsx                 # landing
    (auth)/                  # login, signup, reset password (+token), update password, actions
    onboarding/               # création du business après signup
    dashboard/                # espace pro (protégé par requireBusiness())
      services/ customers/ bookings/ availability/ settings/
      actions.ts              # toutes les mutations métier (Server Actions)
    b/[slug]/                 # page publique de réservation (scoped par slug, jamais par id client)
      confirmed/[bookingId]/  # page de confirmation
    cancel/[token]/           # annulation client via token sécurisé (UUID unique par booking)
    admin/                    # espace platform_admin (stats, businesses, users, bookings)
    api/
      health/                 # healthcheck Railway
      webhooks/stripe/          # webhook compte plateforme
      webhooks/stripe-connect/  # webhook comptes connectés (checkout, account.updated)
      cron/reminders/           # rappels 24h avant (protégé par CRON_SECRET)
  lib/
    db.ts                     # client Prisma singleton
    session.ts                # signature/vérification JWT (edge-compatible, utilisé par middleware)
    auth.ts                   # createSession/requireUser/requireBusiness/requirePlatformAdmin
    stripe.ts  mailer.ts  emails.ts  slots.ts  validators.ts  utils.ts
  middleware.ts               # vérifie le cookie de session, garde /dashboard /admin /onboarding
prisma/
  schema.prisma               # schéma complet (mêmes tables/relations que le cahier des charges)
  migrations/                 # migration SQL versionnée, appliquée par `prisma migrate deploy`
scripts/seed.mjs              # données de démo
```

### Multi-tenant — modèle de sécurité

Pas de RLS ici (pas de Postgres managé avec JWT côté requête) : la sécurité multi-tenant est donc **appliquée au niveau applicatif**, de façon systématique :

1. Chaque table métier a `business_id` (ou équivalent `businessId` côté Prisma) non nul + index.
2. **Toutes** les Server Actions du dashboard passent par `requireBusiness()` (`src/lib/auth.ts`), qui résout le `business_id` **depuis la session serveur** (membership vérifié en base) — jamais depuis une valeur envoyée par le client.
3. Chaque lecture/écriture scope explicitement par `businessId: ctx.business.id` (ex. `db.service.updateMany({ where: { id, businessId: ctx.business.id } })`) : même si un id d'une autre entreprise était deviné, la requête ne matche rien.
4. La page publique (`/b/[slug]`) et les webhooks Stripe ne connaissent jamais un `business_id` fourni tel quel : ils résolvent toujours le business via le `slug` public ou via les `metadata` signées par Stripe, puis re-scopent toutes les requêtes suivantes sur cet id.
5. `platform_admin` : vérifié côté serveur par `requirePlatformAdmin()`, aucune route admin n'est accessible sans ce rôle.

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
npm run db:migrate      # applique le schéma sur ta base locale
npm run dev
```

### 3a. Base de données (Postgres)

En local, pointe simplement `DATABASE_URL` vers un Postgres local ou vers ta base Railway (Railway expose une URL publique dans l'onglet *Connect* du plugin Postgres). Puis :

```bash
npm run db:migrate   # prisma migrate dev — applique prisma/migrations/
```

En prod (Railway), les migrations sont appliquées automatiquement au démarrage (`npm start` lance `prisma migrate deploy` avant `next start`, voir section 4).

### 3b. Sessions

Génère un secret fort pour signer les cookies de session :

```bash
openssl rand -base64 32
```

Colle le résultat dans `SESSION_SECRET`. Sans ce secret, l'app ne démarre pas (fail-fast volontaire).

### 3c. Stripe Connect

1. Compte Stripe (mode **test** d'abord) → active **Connect** avec des comptes **Express**.
2. `STRIPE_SECRET_KEY` + `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` = clés de la plateforme.
3. Webhooks (*Developers → Webhooks*) :
   - Endpoint **compte** : `https://<app>/api/webhooks/stripe` — événement `account.updated` → `STRIPE_WEBHOOK_SECRET`.
   - Endpoint **Connect** ("Listen to events on **connected accounts**") : `https://<app>/api/webhooks/stripe-connect` — événements `checkout.session.completed`, `checkout.session.expired`, `payment_intent.payment_failed`, `account.updated` → `STRIPE_CONNECT_WEBHOOK_SECRET`.
4. En local : `stripe listen --forward-connect-to localhost:3000/api/webhooks/stripe-connect`.

### 3d. Resend

1. Crée un compte [resend.com](https://resend.com) → `RESEND_API_KEY`.
2. Dev : `RESEND_FROM_EMAIL=DetailDesk <onboarding@resend.dev>` fonctionne sans domaine (envoi vers ton propre email uniquement).
3. Prod : vérifie ton domaine dans Resend et utilise `DetailDesk <bookings@tondomaine.com>`.
4. Sans `RESEND_API_KEY`, les emails sont simplement loggés en console + en base (`email_logs`) — les flux ne cassent jamais.

### 3e. Seed de démo

```bash
npm run db:seed
```

Crée : `admin@detaildesk.demo` (platform admin), `owner@detaildesk.demo` (owner du business démo "Shine Detailing", flag test), 3 services, 3 clients, 3 véhicules, 5 réservations, 2 paiements. Mot de passe des deux comptes : `detaildesk-demo-2026`. Page publique : `/b/shine-demo`.

## 4. Déploiement Railway

1. Push le repo sur GitHub.
2. Railway → **New Project → Deploy from GitHub repo** → sélectionne `DetailDesk`.
3. Railway → **New → Database → Add PostgreSQL** dans le même projet.
4. Dans le service de l'app, onglet *Variables* : ajoute `DATABASE_URL` en référence à la base (`${{Postgres.DATABASE_URL}}`), puis toutes les autres variables de `.env.example` (`NEXT_PUBLIC_APP_URL=https://<ton-domaine-railway>`, `APP_ENV=production`, `SESSION_SECRET`, clés Stripe, Resend, `PLATFORM_ADMIN_EMAILS`, `CRON_SECRET`).
5. Railway détecte Next.js (Nixpacks) ; `railway.json` fournit build/start/healthcheck (`/api/health`). Le `npm start` exécute automatiquement `prisma migrate deploy` avant de démarrer le serveur — aucune étape manuelle de migration en prod.
6. Chaque `git push` sur `main` → **redeploy automatique** (build + migration + restart).
7. **Cron des rappels** : Railway → nouveau service "Cron" (ou un cron externe type cron-job.org) qui appelle chaque heure :
   ```
   curl -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/cron/reminders
   ```
8. Mets à jour les endpoints webhooks Stripe avec le domaine de prod une fois le premier déploiement en ligne.

## 5. Rôle platform admin

Les emails listés dans `PLATFORM_ADMIN_EMAILS` reçoivent `platform_role = 'platform_admin'` à l'inscription. Un admin accède à `/admin` : stats globales, liste des businesses (flag test/internal, activation), users, bookings. Pour promouvoir un compte existant en base :

```sql
UPDATE profiles SET platform_role = 'platform_admin' WHERE email = '...';
```

## 6. Limites V1

- 1 business par utilisateur (le schéma supporte déjà plusieurs memberships).
- Rôle `staff` présent en base mais sans invitation UI.
- Slug non modifiable après création.
- Pas de refunds automatiques (structure `payments` prête).
- Logo par URL (pas d'upload de fichier).
- Vue liste des réservations (pas de calendrier drag & drop).
- Annulation publique : pas de remboursement auto de l'acompte.
- Pas de confirmation d'email à l'inscription (le compte est actif immédiatement).

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
| App crash au démarrage avec "SESSION_SECRET is not set" | Variable manquante sur Railway/local — génère-la avec `openssl rand -base64 32` |
| Redirigé vers /login en boucle | Cookie de session absent/invalide : vérifie `SESSION_SECRET` identique entre déploiements |
| Migrations non appliquées en prod | Vérifie que `DATABASE_URL` pointe bien vers le Postgres Railway et que `npm start` (pas juste `next start`) est utilisé |
| "Ce créneau n'est plus disponible" | Créneau pris entre-temps, préavis (`booking_notice_hours`) ou période bloquée |
| Acompte non proposé sur la page publique | Stripe pas connecté (`charges_enabled` false) → Réglages → Vérifier le statut |
| Paiement OK mais réservation "en attente" | Webhook Connect non configuré ou mauvais `STRIPE_CONNECT_WEBHOOK_SECRET` |
| Emails non reçus | Regarde `email_logs` (statut) ; en dev Resend n'envoie qu'à ton propre email sans domaine vérifié |
| Build Railway OK mais crash au démarrage | Variable d'environnement manquante — compare avec `.env.example` |
