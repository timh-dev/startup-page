# Environments & Deployment

The app is a Vite SPA plus serverless functions in `/api`, deployed as one unit on Vercel.
Cloud sync uses **Clerk** (auth), **Stripe** (subscriptions), and **Neon** (Postgres via Drizzle).

Every cloud feature is optional: with no env vars at all, the app runs in
local-only mode (settings in IndexedDB/localStorage). This is what the GitHub
Pages demo and default self-hosted installs get.

## The three environments

Vercel's built-in environments are the stages — there is no separate staging platform.

| | Development (local) | Preview (every PR/branch push) | Production (`main`) |
|---|---|---|---|
| URL | `localhost:3000` via `make dev-cloud` | `<project>-git-<branch>-….vercel.app` | your domain |
| Clerk | dev instance (`pk_test`/`sk_test`) | dev instance | prod instance (`pk_live`/`sk_live`) |
| Stripe | test mode + `stripe listen` | test mode | live mode |
| Neon | `dev` branch | `dev` branch (or branch-per-preview) | `main` branch |

Environment variables live in **Vercel → Project → Settings → Environment
Variables**, each scoped to one or more environments. Local dev pulls them with
`make env-pull` (writes `.env.local`, which is git-ignored). Never commit real
values; `.env.example` documents every variable.

## One-time setup

### 1. Neon (database)

Fastest path — provision through the Vercel Marketplace (creates the database,
injects `DATABASE_URL` into the project, unified billing, free plan available):

```sh
npx vercel integration add neon
```

Manual path:

1. Create a project at [neon.tech](https://neon.tech) (free tier is plenty — the app stores a few small JSON records per user; see [sync.md](./sync.md)).
2. It comes with a `main` branch — that's Production. Create a second branch called `dev` for Development/Preview.
3. Copy each branch's connection string (pooled, `sslmode=require`) — these become `DATABASE_URL`.
   - Optional: install the [Neon Vercel integration](https://vercel.com/integrations/neon) to auto-inject `DATABASE_URL` and create an isolated DB branch per preview deployment.
4. Migrations run automatically during every Vercel build (`scripts/migrate.mjs` → `drizzle-kit migrate`), so each environment's database is migrated with the code that uses it. To run them by hand: `make db-migrate`.

### 2. Clerk (auth)

Clerk is also on the Vercel Marketplace (`npx vercel integration add clerk`),
which creates the app and injects the keys for you. Manual path:

1. Create an application at [clerk.com](https://clerk.com). You get a **Development instance** immediately — its `pk_test_…`/`sk_test_…` keys serve Development *and* Preview (dev instances accept any origin, which is exactly what wildcard preview URLs need).
2. When ready for production, create the **Production instance** (Clerk dashboard → top-left instance switcher → "Create production instance"), attach your real domain, and follow its DNS steps. That gives you `pk_live_…`/`sk_live_…`.
3. Free tier: 10,000 MAU — effectively free for this project until it isn't.

### 3. Stripe (billing)

1. In **test mode**: Products → create "Cloud Sync" with a recurring price (recommended: yearly, ~$10/yr — a $0.99 monthly charge loses ~33% to Stripe's per-transaction fee). Copy the `price_…` id.
2. In **live mode**: create the same product/price. Live and test keys/prices are separate.
3. Webhooks:
   - **Production**: Developers → Webhooks (live mode) → add endpoint `https://<your-domain>/api/webhooks/stripe`, subscribed to `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`. Copy its `whsec_…` as Production `STRIPE_WEBHOOK_SECRET`.
   - **Local**: `make stripe` (Stripe CLI) forwards test events to `localhost:3000` and prints a `whsec_…` for `.env.local`.
   - **Preview**: preview URLs change per branch, so dashboard webhooks aren't practical — test webhook flows locally with `make stripe` + `make stripe-test-sub`. (Preview still exercises checkout redirects fine; only the webhook delivery needs the CLI.)

### 4. Vercel env vars

Set in the dashboard, or from the terminal (each command prompts for the value):

```sh
# Production
npx vercel env add VITE_CLERK_PUBLISHABLE_KEY production   # pk_live_…
npx vercel env add CLERK_SECRET_KEY production             # sk_live_…
npx vercel env add DATABASE_URL production                 # Neon main branch
npx vercel env add STRIPE_SECRET_KEY production            # sk_live_…
npx vercel env add STRIPE_WEBHOOK_SECRET production        # whsec_… (live endpoint)
npx vercel env add STRIPE_PRICE_ID production              # live price
npx vercel env add APP_URL production                      # https://your-domain.com
npx vercel env add COMP_USER_EMAILS production             # tpholmes7@gmail.com

# Preview + Development (test-mode keys, Neon dev branch) — repeat per var:
npx vercel env add VITE_CLERK_PUBLISHABLE_KEY preview development
# … same list as above with test values; APP_URL can be omitted
# (the API falls back to the deployment's own URL).
```

Then pull them for local dev:

```sh
make env-pull        # → .env.local + .env.dev (Development) and .env.prd (Production)
```

**Sensitive-variable caveat:** this team's policy stores CLI/dashboard-added
Production and Preview values as *sensitive* — deployments receive them
normally, but `vercel env pull` returns them as empty strings. So `.env.prd`
comes back with blanks for `DATABASE_URL`, `COMP_USER_EMAILS`, and
`VITE_CLERK_PUBLISHABLE_KEY` (integration-provisioned vars like
`CLERK_SECRET_KEY` still pull fine). Keep production values recorded somewhere
safe when you set them; re-running `make env-pull` blanks the hand-filled ones
in `.env.prd`. Development values always pull complete.

## Free accounts (owner / friends / self-hosters)

Two env vars on the API control who gets sync access without paying:

- **`COMP_USER_EMAILS`** — comma-separated list of emails treated as subscribed.
  Set it to your own email in every environment so your account never pays.
  The subscription-status endpoint reports these users as `active`, so the app
  UI shows them as subscribed and never offers checkout.
- **`REQUIRE_SUBSCRIPTION=false`** — disables the paywall entirely. For
  self-hosters running their own backend + Clerk instance; never set this on
  the paid hosted deployment.

## Day-to-day workflows

```sh
make dev          # frontend only, local-only mode (no auth, no sync)
make dev-cloud    # full stack on :3000 (vercel dev: Vite + /api functions)
make stripe       # terminal 2: forward Stripe test webhooks to :3000
make health       # check the local API

git push          # any branch → Vercel Preview deployment (test keys, dev DB)
# merge to main   → Production deployment
make deploy-vercel  # manual production deploy from this machine
make deploy         # GitHub Pages demo (keyless, local-only build)
```

First time only: `npx vercel login` and `npx vercel link` (already linked in this repo: project `startup-page-iebp`).

### Changing the database schema

1. Edit `api/_lib/schema.ts`
2. `make db-generate` → writes SQL to `drizzle/` (commit it)
3. Migrations apply automatically on the next deploy (`make db-migrate` to run locally)

## Self-hosting matrix

| Mode | What to set | What you get |
|---|---|---|
| Local-only (default) | nothing | Full app, settings on-device, import/export backups |
| Own cloud, no billing | all vars except Stripe + `REQUIRE_SUBSCRIPTION=false` | Sync for every signed-in user, free |
| Full hosted product | everything | Sync gated behind Stripe subscription + comp list |
