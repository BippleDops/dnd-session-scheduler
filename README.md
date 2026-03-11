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
# Clone and install
git clone https://github.com/<your-username>/dnd-session-scheduler.git
cd dnd-session-scheduler
npm install
cd client && npm install && cd ..

# Configure environment
cp env.example .env
# Edit .env — at minimum set:
#   SESSION_SECRET (random 64+ char string)
#   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
#   GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
#   ADMIN_EMAILS=your-email@gmail.com
#   EMAIL_AUTO_SEND=false  (draft mode — no emails sent during dev)
```

### Run (development)

You need two terminals — one for the backend, one for the frontend dev server:

```bash
# Terminal 1: Backend (auto-restarts on file changes)
npm run dev

# Terminal 2: Frontend (Next.js dev server with hot reload)
cd client
npm run dev
```

The backend runs on `http://localhost:3000`. The Next.js dev server runs on `http://localhost:3001` (or whichever port Next.js picks).

### Run with Docker

```bash
docker compose up --build
```

This starts three services:

| Service | Port | Description |
|---------|------|-------------|
| dnd-scheduler | 3001 | Main application |
| sqlitebrowser | 3002 (localhost only) | SQLite DB viewer |
| uptime-kuma | 3003 (localhost only) | Health monitoring |

The SQLite database persists in `./data/`.

## Testing

The backend has a Jest test suite covering utility functions, middleware, and all service modules. Tests use an in-memory SQLite database so they run fast and don't touch any real data.

### Run tests

```bash
# Run all tests
npm test

# Run tests in watch mode (re-runs on file changes)
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

1. **Health check** — `curl http://localhost:3000/health` should return a JSON response confirming DB connectivity.

2. **Walk-through:**
   - Visit the home page and confirm the Quest Board loads
   - Log in with Google OAuth
   - Complete your profile (name + "played before" question)
   - Browse sessions, sign up for one
   - Create a character
   - If you're an admin (`ADMIN_EMAILS`), verify the admin dashboard loads at `/admin`

3. **Email draft mode** — Set `EMAIL_AUTO_SEND=false` in `.env`. Emails will be logged to the `email_log` table and the console instead of being sent.

4. **API spot checks:**

   ```bash
   # Public endpoints (no auth required)
   curl http://localhost:3000/api/sessions
   curl http://localhost:3000/api/campaigns
   curl http://localhost:3000/api/recaps
   ```

## CI/CD

The project has two GitHub Actions workflows:

### Test (`ci.yml`)

Runs on pushes to `feature/**` and `bugfix/**` branches, and on pull requests to `main`. Installs dependencies on Node 20 and runs `npm test`.

### Build & Deploy (`deploy.yml`)

Triggered on every push to `main`:

### Build & Push to GHCR

1. **Checkout** — Pulls the latest code.
2. **Login** — Authenticates to GitHub Container Registry (`ghcr.io`) using the built-in `GITHUB_TOKEN`.
3. **Metadata** — Tags the image with the commit SHA and `latest`.
4. **Build & Push** — Runs the multi-stage Dockerfile:
   - **Stage 1 (frontend):** Installs client dependencies and runs `next build` to produce a static export (`client/out/`).
   - **Stage 2 (backend-deps):** Compiles native modules (better-sqlite3) in an Alpine build environment.
   - **Stage 3 (runtime):** Assembles the final lightweight image — copies pre-built node_modules, server source, and the static frontend into the Express `public/` directory. Runs as a non-root user.
5. The resulting image is pushed to `ghcr.io/<owner>/dnd-session-scheduler:latest`.

From there, the production host pulls the new image and restarts the container (handled outside this repo).

## Project Structure

```text
├── src/
│   ├── server.js              # Express entry point + cron jobs
│   ├── db.js                  # SQLite schema & query utilities
│   ├── routes/                # API + page routes
│   │   ├── api-public.js      # Public endpoints (/api/sessions, etc.)
│   │   ├── api-admin.js       # Admin endpoints (/api/admin/*)
│   │   ├── api-v3.js          # Campaign/character APIs
│   │   ├── api-v4.js          # Session prep & moments
│   │   ├── api-sse.js         # Server-sent events
│   │   ├── auth.js            # Google OAuth routes
│   │   └── pages.js           # EJS page routes
│   ├── services/              # Business logic layer
│   │   ├── session-service.js
│   │   ├── registration-service.js
│   │   ├── reminder-service.js
│   │   └── ...
│   ├── middleware/             # Auth, CSRF, rate limiting
│   └── email/                 # Email templates
├── client/                    # Next.js 16 frontend
│   └── src/
│       ├── app/               # 18 pages (App Router)
│       ├── components/        # UI + layout components
│       ├── hooks/             # useApi, useAuth, useSwipe, etc.
│       └── lib/               # API client, utils, theme
├── data/                      # SQLite DB + backups (gitignored)
├── Dockerfile                 # Multi-stage build
├── docker-compose.yml         # App + SQLite viewer + Uptime Kuma
└── env.example                # Environment variable template
```

## Environment Variables

See [`env.example`](env.example) for the full list. Key variables:

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

The server runs four cron jobs (all times in America/Chicago):

| Time | Job | Description |
|------|-----|-------------|
| 8:00 AM | Reminder check | Emails players with sessions in ~24 hours |
| 10:00 AM | Auto-briefing | Sends party briefings for sessions in ~48 hours |
| 1:00 AM | Auto-complete | Marks past sessions as "Completed" |
| 2:00 AM | Daily backup | Backs up SQLite DB to `data/backups/` |
