# D&D Session Scheduler

A self-hosted web portal for managing tabletop RPG sessions. Players can browse upcoming games, sign up, manage characters, and get automated email reminders. DMs and admins get a dashboard for session management, player tracking, approvals, and session prep tools.

**Live:** <https://dndsignup.get-suss.com>

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Express.js (Node 20) |
| Frontend | Next.js 16 + React 19 + Tailwind CSS 4 |
| Database | SQLite (better-sqlite3, WAL mode) |
| Auth | Google OAuth 2.0 (Passport.js) |
| Email | Nodemailer (Gmail SMTP) |
| Deployment | Docker + GitHub Actions → GHCR |

## Monorepo Structure

```text
├── apps/
│   ├── api/                      # Express backend (API-only)
│   │   ├── src/
│   │   │   ├── server.js         # Express entry point + cron jobs
│   │   │   ├── db.js             # SQLite schema & query utilities
│   │   │   ├── routes/           # API + auth routes
│   │   │   ├── services/         # Business logic layer
│   │   │   ├── middleware/       # Auth, CSRF, rate limiting
│   │   │   └── email/            # Email templates
│   │   ├── tests/                # Jest test suite
│   │   ├── data/                 # SQLite DB, sessions store + backups (gitignored, created on first run)
│   │   ├── env.example           # All environment variables, documented
│   │   ├── Dockerfile            # Node.js Alpine image (runs as `node`)
│   │   └── package.json
│   │
│   └── web/                      # Next.js frontend (static export)
│       ├── src/
│       │   ├── app/              # Pages (App Router)
│       │   ├── components/       # UI + layout components
│       │   ├── hooks/            # useApi, useAuth, useSwipe, etc.
│       │   └── lib/              # API client, utils, theme
│       ├── nginx.conf            # Reverse proxy config
│       ├── next.config.ts        # Static export + dev proxy to the API
│       ├── Dockerfile            # Multi-stage build → nginx
│       └── package.json
│
├── data/                         # Docker only: bind-mounted into the API container as /app/data (gitignored)
├── docker-compose.yml            # API + Web + SQLite viewer + Uptime Kuma
├── docker-compose.n8n.yml        # Optional override: attach to an existing n8n network
└── .github/workflows/            # CI + deploy per app
```

## Architecture

The app runs as **two containers** behind an nginx reverse proxy:

- **dnd-api** — Express server handling `/api/*`, `/auth/*`, and `/health`. No static files, no templates.
- **dnd-web** — nginx serving the Next.js static export and proxying API/auth requests to the API container.

This separation means the frontend and backend can be built, deployed, and scaled independently. Cookie-based auth works because nginx keeps everything on the same origin.

## Features

### Players

- Google OAuth login
- Quest Board with calendar view of upcoming sessions
- Session signup with waitlist support
- Character management (create, level up, retire)
- Campaign browsing with lore and house rules
- Personal iCal feed for calendar sync
- Session recaps and loot tracking
- Email reminders (24h before session)

### Admin / DM

- Session CRUD with approval workflows
- Player management and contact lists
- Session prep tools (briefings, teasers, party rosters)
- Session history, recaps, and moment tracking
- Configuration panel (email settings, reminders)
- Data export and daily backups
- Audit log

## Local Development

### Prerequisites

- Node.js 20+
- A Google OAuth client ID/secret ([console.cloud.google.com](https://console.cloud.google.com))

### Setup

```bash
# Clone
git clone https://github.com/<your-username>/dnd-session-scheduler.git
cd dnd-session-scheduler

# Configure environment — the API loads apps/api/.env from its own directory
cp apps/api/env.example apps/api/.env
# Edit apps/api/.env — at minimum set:
#   NODE_ENV=development
#   SESSION_SECRET (random 64+ char string, e.g. `openssl rand -hex 32`)
#   BASE_URL=http://localhost:3001
#   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
#   GOOGLE_CALLBACK_URL=http://localhost:3001/auth/google/callback
#   ADMIN_EMAILS=your-email@gmail.com
#   EMAIL_AUTO_SEND=false  (draft mode — no emails sent during dev)
#   INITIAL_CAMPAIGNS=Aethermoor,Two Cities  (optional — campaigns seeded into a fresh database)

# Install dependencies
cd apps/api && npm ci && cd ../..
cd apps/web && npm ci && cd ../..
```

### Run (development)

Two terminals — one for the backend, one for the frontend dev server:

```bash
# Terminal 1: Backend on http://localhost:3000 (auto-restarts on file changes)
cd apps/api
npm run dev

# Terminal 2: Frontend on http://localhost:3001 (hot reload)
cd apps/web
npm run dev            # = next dev -p 3001; pass `-- -p 4000` to use another port
```

Open **http://localhost:3001**. In development the Next.js dev server proxies `/api/*`, `/auth/*`
and `/health` to the Express server (rewrites in `apps/web/next.config.ts`, target
`API_DEV_ORIGIN`, default `http://localhost:3000`), so the browser talks to a single origin and
session cookies work without CORS — the same thing nginx does in production. The API has no CORS
headers; only set `NEXT_PUBLIC_API_URL` if you serve the API from a different origin and add CORS
yourself.

The SQLite database, session store and backups are created under `apps/api/data/` on first start
(override the location with `DB_PATH`).

### Run with Docker

```bash
# docker-compose reads ./.env (repo root) for both variable substitution and the API container's environment
cp apps/api/env.example .env
# Set SESSION_SECRET, BASE_URL, Google OAuth values, ADMIN_EMAILS and the sqlitebrowser
# credentials SQLITE_BROWSER_USER / SQLITE_BROWSER_PASS (required — no defaults).
docker compose up --build

# Hosts that run the n8n stack can attach dnd-api and uptime-kuma to its network:
docker compose -f docker-compose.yml -f docker-compose.n8n.yml up --build -d
```

| Service | Port | Description |
|---------|------|-------------|
| dnd-web | 3001 | Frontend (nginx + static) + API proxy |
| dnd-api | internal | Express API (not exposed to host) |
| sqlitebrowser | 3002 (localhost only) | SQLite DB viewer |
| uptime-kuma | 3003 (localhost only) | Health monitoring |

The SQLite database persists in `./data/`, bind-mounted into the API container as `/app/data`. The
container runs as the unprivileged `node` user (uid 1000), so `./data` must be writable by that uid
(`chown -R 1000:1000 data` if needed). The web image bakes `NEXT_PUBLIC_SITE_URL` (defaults to
`BASE_URL`) into the static export for canonical/OpenGraph metadata.

## Testing

The backend has a Jest test suite covering utility functions, middleware, and all service modules. Tests use an in-memory SQLite database so they run fast and don't touch any real data.

### Run tests

```bash
cd apps/api

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# CI variant (--ci --forceExit --detectOpenHandles)
npm run test:ci
```

### What's tested

| Area | Test file | Coverage |
|------|-----------|----------|
| DB utilities | `tests/db/db-utils.test.js` | `generateUuid`, `nowTimestamp`, `maskEmail`, `normalizeDate`, `normalizeTime` |
| DB config/logging | `tests/db/db-config.test.js` | `getConfigValue`, `setConfigValue`, `logAction` |
| DB migrations | `tests/db/db-migrations.test.js` | `initializeDatabase` on fresh and legacy databases, `INITIAL_CAMPAIGNS` seeding |
| Secrets / time config | `tests/config/*.test.js` | `SESSION_SECRET` fail-fast, link-signing secret, timezone date helpers |
| Auth middleware | `tests/middleware/auth.test.js` | `isAdmin`, `requireAuth`, `requireAdmin`, `injectUser`, JSON 401/403 through a mounted router |
| CSRF tokens | `tests/middleware/csrf.test.js` | Generate, validate, session binding, single-use, cancel tokens |
| Routes | `tests/routes/*.test.js` | SSE auth + connection cap, `GET /api/players/:id` visibility |
| Rate limiting | `tests/middleware/rate-limit.test.js` | Signup attempt throttling (5 per 10 min) |
| Session service | `tests/services/session-service.test.js` | CRUD, tier validation, clone, auto-complete, history |
| Player service | `tests/services/player-service.test.js` | Upsert, lookup, status, contacts, admin list |
| Character service | `tests/services/character-service.test.js` | CRUD, retire, XP/leveling, URL sanitization, loot |
| Registration service | `tests/services/registration-service.test.js` | Signup flow, approval, rejection, cancellation, waitlist, attendance |
| Campaign service | `tests/services/campaign-service.test.js` | CRUD, sessions, roster, timeline |
| Notification service | `tests/services/notification-service.test.js` | Create, read, mark read, unread count |
| Export service | `tests/services/export-service.test.js` | CSV export, roster export, quote escaping |

### Manual smoke test

1. **Health check** — `curl http://localhost:3000/health` should return JSON confirming DB connectivity.
2. **Walk-through** — Log in, complete profile, browse sessions, sign up, create a character, verify admin dashboard.
3. **Email draft mode** — Set `EMAIL_AUTO_SEND=false`. Emails log to the `email_log` table instead of sending.

## CI/CD

Four GitHub Actions workflows, split by app:

### API

| Workflow | Trigger | What it does |
|----------|---------|-------------|
| `api-ci.yml` | Push to `main` / `feature/**` / `bugfix/**`, PRs to `main` | Installs deps, runs `npm run test:ci` |
| `api-deploy.yml` | `api-ci.yml` succeeded for a push to `main` | Builds the tested commit, pushes to `ghcr.io/.../api:latest` |

### Web

| Workflow | Trigger | What it does |
|----------|---------|-------------|
| `web-ci.yml` | Push to `main` / `feature/**` / `bugfix/**`, PRs to `main` | Installs deps, lints (`--max-warnings=0`), builds static export |
| `web-deploy.yml` | `web-ci.yml` succeeded for a push to `main` | Builds the tested commit, pushes to `ghcr.io/.../web:latest` |

The CI workflows use path filters so only the relevant app's pipeline runs when its files change. Deploys are chained
off CI with `workflow_run`, so a red test suite never publishes `:latest`. Third-party actions are pinned to commit SHAs
(the version is kept as a trailing comment). `web-deploy.yml` passes the `NEXT_PUBLIC_SITE_URL` repository variable
(Settings → Secrets and variables → Actions → Variables) into the image build for canonical/OpenGraph URLs.

From there, the production host pulls the new images and restarts the containers (handled outside this repo).

## Environment Variables

See [`apps/api/env.example`](apps/api/env.example) for the full list. Key variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `SESSION_SECRET` | Yes | Random string for cookie signing (64+ chars). **The server refuses to start in production without it.** |
| `BASE_URL` | Yes | Public origin (`https://…`). Used in emails, iCal UIDs and OAuth redirects |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | Yes | OAuth redirect URI |
| `ADMIN_EMAILS` | Yes | Comma-separated admin email addresses |
| `SCHEDULER_TIMEZONE` | No | IANA timezone for cron jobs, reminder windows and iCal (default `America/Chicago`) |
| `INITIAL_CAMPAIGNS` | No | Comma-separated campaigns seeded into a fresh database (default none) |
| `UNSUBSCRIBE_SECRET` | No | Separate secret for signed one-click email links (defaults to `SESSION_SECRET`) |
| `SSE_MAX_CLIENTS_PER_SESSION` | No | Max concurrent live-session streams per game session (default 50) |
| `DB_PATH` | No | SQLite file location (default `apps/api/data/scheduler.db`) |
| `SMTP_USER` / `SMTP_PASS` | For email | Gmail address + App Password |
| `EMAIL_AUTO_SEND` | No | `true` to send emails, `false` for draft mode |
| `DISCORD_WEBHOOK_URL` | No | Discord notifications |
| `GOOGLE_CALENDAR_ID` | No | Google Calendar sync |
| `SQLITE_BROWSER_USER` / `SQLITE_BROWSER_PASS` | Docker | Credentials for the sqlitebrowser container |
| `NEXT_PUBLIC_SITE_URL` | Docker / web build | Public origin baked into the web static export (defaults to `BASE_URL`) |

## Scheduled Jobs

The API server runs four cron jobs, all in `SCHEDULER_TIMEZONE` (default America/Chicago):

| Time | Job | Description |
|------|-----|-------------|
| `REMINDER_TRIGGER_HOUR` (admin config, default 8:00 AM) | Reminder check | Emails players with sessions in ~24 hours; checked hourly so config changes apply without a restart |
| 10:00 AM | Auto-briefing | Sends party briefings for sessions two calendar days out |
| 1:00 AM | Auto-complete | Marks past sessions as "Completed" |
| 2:00 AM | Daily backup | Backs up SQLite DB to `data/backups/` |
