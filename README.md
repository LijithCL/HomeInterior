# Home Interior & Exterior Design Platform

A full-stack SaaS for designing homes in 2D, 3D, and 4D (construction timeline), with an AI design assistant, async rendering, team collaboration, and Stripe-based billing.

Full architecture reference (system design, DB schema, all 8 build phases, risks): **[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)**.

## Stack

- **API**: NestJS 11, Prisma ORM 7 (`@prisma/adapter-pg`), PostgreSQL 16, Passport/JWT
- **Web**: Next.js 16 (App Router), React 19, Zustand, Konva (2D), React Three Fiber (3D)
- **AI**: Claude via `@anthropic-ai/sdk`, behind a provider interface that falls back to a free, deterministic stub when no API key is set
- **Billing**: Stripe, in test mode by default
- **Storage**: local disk, not S3 — see "Local storage, not cloud" below
- **Monorepo**: pnpm workspaces + Turborepo

## Prerequisites

- Node.js **22+** (see `engines` in `package.json`; `nvm use 22` if your default is older)
- pnpm (via Corepack: `corepack enable`)
- PostgreSQL 16 running locally (or via `infra/docker-compose.yml`)
- Google Chrome installed at a known path, for the render pipeline and any Playwright-based testing (`CHROME_EXECUTABLE_PATH`)

## Setup

```bash
pnpm install

# Postgres: either use your own native install, or:
docker compose -f infra/docker-compose.yml up -d

# apps/api/.env and apps/web/.env.local — copy the example and fill in secrets
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.local.example apps/web/.env.local

pnpm db:generate
pnpm db:migrate
pnpm db:seed        # first-time only — ~40 starter assets; not idempotent, don't re-run on a populated DB

pnpm dev             # starts both apps/api (:3001) and apps/web (:3000) via Turborepo
```

Then register an account at `http://localhost:3000/register`.

### Promoting a user to admin (asset library management)

```bash
pnpm --filter api admin:promote you@example.com
```

## Environment variables

All required/optional vars are documented inline in `apps/api/.env.example`, and the app **fails fast at boot** with a clear message if a required one is missing or malformed (see `apps/api/src/env.validation.ts`). Summary:

| Var | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | yes | ≥16 chars |
| `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL` | yes | e.g. `15m`, `30d` |
| `WEB_ORIGIN`, `PUBLIC_API_URL` | yes | Used for CORS and building absolute signed-URL/share/redirect links |
| `STORAGE_ROOT`, `UPLOAD_SIGNING_SECRET` | yes | Local object storage — see below |
| `CHROME_EXECUTABLE_PATH` | optional | Needed for rendering; app boots without it, render jobs fail without it |
| `ANTHROPIC_API_KEY` | optional | Unset → free `StubAiProvider`. Set → real Claude calls, billed |
| `STRIPE_SECRET_KEY`, `STRIPE_PRO_PRICE_ID`, `STRIPE_WEBHOOK_SECRET` | optional | Unset → billing endpoints return "not configured" instead of crashing. Use **test-mode** keys — see [dashboard.stripe.com/test/apikeys](https://dashboard.stripe.com/test/apikeys) |

## Testing

```bash
pnpm test           # unit tests for both apps (Jest for api, Vitest for web)
pnpm test:e2e        # apps/api end-to-end tests (supertest, real DB)
```

**One-time setup for e2e tests** — they run against a dedicated test database, never your dev data:

```bash
createdb homeinterior_test
DATABASE_URL="<same as apps/api/.env but dbname=homeinterior_test>" pnpm --filter api prisma:migrate
```

`apps/api/test/setup-env.ts` then points `DATABASE_URL` at `homeinterior_test` automatically for every e2e run, regardless of what's in `apps/api/.env`.

Two testing quirks worth knowing about if you're debugging a red test run:
- **`test:e2e` requires `NODE_OPTIONS=--experimental-vm-modules`** (already set in the npm script). Prisma 7's query compiler does a dynamic `import()` internally; without this flag Jest throws `A dynamic import callback was invoked without --experimental-vm-modules`.
- **Jest needs a `moduleNameMapper`** stripping `.js` from relative imports (already configured in both `apps/api/package.json`'s `jest` block and `test/jest-e2e.json`). Prisma 7's generated client uses NodeNext-style imports like `from "./internal/class.js"` for a `.ts` file on disk — ts-jest's default CommonJS resolution doesn't understand that convention without help.

Coverage today is deliberately scoped to the highest-risk logic, not exhaustive: permission resolution (owner/editor/viewer), AI proposal application (`edit-ops`, `layout-builder`), billing plan resolution, and the sharing flow end-to-end. UI-level behavior across all 8 phases was verified live with Playwright during development but those scripts weren't checked into the repo.

## Local storage, not cloud

This project intentionally uses local disk storage (`STORAGE_ROOT`) instead of S3 or another paid object store — see `docs/ARCHITECTURE.md` §B/§O for the reasoning. The consequence: **there is no redundancy unless you back it up yourself.**

```bash
./infra/backup.sh                          # dumps Postgres + tars STORAGE_ROOT
BACKUP_DIR=/mnt/other-disk ./infra/backup.sh   # point at real off-site/second-disk storage
```

Run it on a schedule, e.g. nightly via cron:

```
0 3 * * * cd /path/to/repo && BACKUP_DIR=/mnt/backups ./infra/backup.sh >> /var/log/homeinterior-backup.log 2>&1
```

The default `BACKUP_DIR` (a sibling directory outside the repo) only protects against a repo-level mistake (`rm -rf`), **not** a disk failure — override it for real disaster recovery.

## Production-hardening notes (Phase 9)

Beyond the 8 feature phases, the app also has:
- Startup env validation, a global exception filter (consistent error shape, no leaked internal error text), a request-id + access-log interceptor, and DB-aware `/health`
- Rate limiting (`@nestjs/throttler`) — tight limits on `/auth/register`, `/auth/login`, AI generation, and render-job creation; a generous global default elsewhere
- The backup script above

**Not built, and why:**
- **Docker/CI pipeline** — needs a hosting/CI-provider decision this repo doesn't have yet, and this repo's git root is currently misconfigured (see below) — not safe to add a CI workflow file until that's resolved.
- **Real-time multi-user co-editing** — explicitly scoped out of Phase 8 as a stretch goal; would be its own phase (WebSocket gateway + conflict resolution).

## ⚠️ Known issue: git repository root

`git rev-parse --show-toplevel` resolves to `/home/alignminds` (the entire home directory), not this project directory — no sibling project folders have their own `.git`. This means the repo, if committed to, would include SSH keys, cloud credentials, shell history, and other sensitive files outside this project. **No git commands have been run against this state.** Resolve this (e.g., `git init` a proper repo at this directory and migrate history, or add a global `.gitignore`/sparse-checkout) before ever running `git add`/`git commit`/`git push` here.
