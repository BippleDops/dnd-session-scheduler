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
│   │   ├── Dockerfile            # Node.js Alpine image
│   │   └── package.json
│   │
│   └── web/                      # Next.js frontend (static export)
│       ├── src/
│       │   ├── app/              # Pages (App Router)
│       │   ├── components/       # UI + layout components
│       │   ├── hooks/            # useApi, useAuth, useSwipe, etc.
│       │   └── lib/              # API client, utils, theme
│       ├── nginx.conf            # Reverse proxy config
│       ├── Dockerfile            # Multi-stage build → nginx
│       └── package.json
│
├── data/                         # SQLite DB + backups (gitignored)
├── docker-compose.yml            # API + Web + SQLite viewer + Uptime Kuma
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

# Configure environment
cp apps/api/env.example .env
# Edit .env — at minimum set:
#   SESSION_SECRET (random 64+ char string)
#   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
#   GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
#   ADMIN_EMAILS=your-email@gmail.com
#   EMAIL_AUTO_SEND=false  (draft mode — no emails sent during dev)

# Install dependencies
cd apps/api && npm install && cd ../..
cd apps/web && npm install && cd ../..
```

### Run (development)

Two terminals — one for the backend, one for the frontend dev server:

```bash
# Terminal 1: Backend (auto-restarts on file changes)
cd apps/api
npm run dev

# Terminal 2: Frontend (Next.js dev server with hot reload)
cd apps/web
npm run dev
```

The backend runs on `http://localhost:3000`. The Next.js dev server runs on `http://localhost:3001`.

### Run with Docker

```bash
docker compose up --build
```

| Service | Port | Description |
|---------|------|-------------|
| dnd-web | 3001 | Frontend (nginx + static) + API proxy |
| dnd-api | internal | Express API (not exposed to host) |
| sqlitebrowser | 3002 (localhost only) | SQLite DB viewer |
| uptime-kuma | 3003 (localhost only) | Health monitoring |

The SQLite database persists in `./data/`.

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
```

### What's tested

| Area | Test file | Coverage |
|------|-----------|----------|
| DB utilities | `tests/db/db-utils.test.js` | `generateUuid`, `nowTimestamp`, `maskEmail`, `normalizeDate`, `normalizeTime` |
| DB config/logging | `tests/db/db-config.test.js` | `getConfigValue`, `setConfigValue`, `logAction` |
| Auth middleware | `tests/middleware/auth.test.js` | `isAdmin`, `requireAuth`, `requireAdmin`, `injectUser` |
| CSRF tokens | `tests/middleware/csrf.test.js` | Generate, validate, single-use, cancel tokens |
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
| `api-ci.yml` | Push to `feature/**` / `bugfix/**`, PRs to `main` | Installs deps, runs `npm test` |
| `api-deploy.yml` | Push to `main` | Builds Docker image, pushes to `ghcr.io/.../api:latest` |

### Web

| Workflow | Trigger | What it does |
|----------|---------|-------------|
| `web-ci.yml` | Push to `feature/**` / `bugfix/**`, PRs to `main` | Installs deps, lints, builds static export |
| `web-deploy.yml` | Push to `main` | Builds Docker image, pushes to `ghcr.io/.../web:latest` |

All workflows use path filters so only the relevant app's pipeline runs when its files change.

From there, the production host pulls the new images and restarts the containers (handled outside this repo).

## Environment Variables

See [`apps/api/env.example`](apps/api/env.example) for the full list. Key variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `SESSION_SECRET` | Yes | Random string for cookie signing (64+ chars) |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | Yes | OAuth redirect URI |
| `ADMIN_EMAILS` | Yes | Comma-separated admin email addresses |
| `SMTP_USER` / `SMTP_PASS` | For email | Gmail address + App Password |
| `EMAIL_AUTO_SEND` | No | `true` to send emails, `false` for draft mode |
| `DISCORD_WEBHOOK_URL` | No | Discord notifications |
| `GOOGLE_CALENDAR_ID` | No | Google Calendar sync |

## Scheduled Jobs

The API server runs four cron jobs (all times in America/Chicago):

| Time | Job | Description |
|------|-----|-------------|
| 8:00 AM | Reminder check | Emails players with sessions in ~24 hours |
| 10:00 AM | Auto-briefing | Sends party briefings for sessions in ~48 hours |
| 1:00 AM | Auto-complete | Marks past sessions as "Completed" |
| 2:00 AM | Daily backup | Backs up SQLite DB to `data/backups/` |
