# Live Word Survey

A small full-stack app: an admin creates a short survey (1–2 free-text-word
questions, a duration in minutes), shares a link, and respondents log in
with mobile number + OTP to submit one word each. Server-side fuzzy
matching clusters near-duplicate words (typos, plurals, etc.) and results
render live as a bubble chart, polling every 5 seconds, until the survey's
time window closes.

## Stack

| Layer     | Tech                                                        |
|-----------|--------------------------------------------------------------|
| Frontend  | React + Vite + TypeScript, Tailwind CSS                     |
| Backend   | Node.js + Express + TypeScript, `string-similarity` for fuzzy matching |
| Database  | PostgreSQL                                                   |
| Proxy     | Nginx (serves the built SPA, proxies `/api/*` to the API)    |
| Orchestration | Docker Compose — 3 services: `web`, `api`, `db`          |

The same `docker-compose.yml` runs on a laptop and on a single EC2 instance
behind an Elastic IP — no separate prod config.

## Project layout

```
api/            Express + TypeScript backend, Jest tests, SQL migrations
web/            React + Vite + TypeScript frontend, Vitest tests
nginx/          Reverse proxy config
deploy/         EC2 setup + deploy scripts
scripts/        run-tests.sh — local test runner
.github/workflows/ci.yml   CI: tests + build on every push
docker-compose.yml         Local & production stack
docker-compose.test.yml    Disposable Postgres for running API tests
```

## Quick start (laptop)

1. Copy the env template and fill in values (defaults are fine for local dev):

   ```bash
   cp .env.example .env
   ```

2. Bring the stack up:

   ```bash
   docker compose up --build
   ```

3. Open the app:
   - Admin dashboard: <http://localhost/admin>
   - Sign in with the `ADMIN_USERNAME` / `ADMIN_PASSWORD` from your `.env`
     (the API seeds this account into Postgres on startup).

4. Create a survey, copy the share link (`/s/<slug>`), and open it in
   another tab/incognito window to try the respondent flow. Since this is a
   test-bed with no real SMS integration, the OTP code is shown directly on
   the page after you request it.

Stop everything with `docker compose down` (add `-v` to also wipe the
Postgres volume).

## Seed / test instructions

There's no separate seed script — the flow is meant to be exercised live:

1. **Create a survey** as admin: title, 1–2 questions, duration in minutes.
   You'll get back a shareable URL like `/s/bold-otter-4821`.
2. **Answer it** as a respondent: open the link, enter any phone number
   (e.g. `+15551234567`), click "Send code", copy the on-page test code
   into the OTP field, then submit a word.
3. **Try a near-duplicate**: open the same survey in a different
   phone-number session and submit a typo of a word you already used (e.g.
   "hapy" vs "happy") — it should fold into the same bubble on the results
   view within 5 seconds.
4. **Try resubmitting** with the same phone number — the API rejects it
   with "You've already answered this survey".
5. **Let the duration elapse** (or set a 1-minute survey) — after
   `start_time + duration_minutes`, the survey flips to Closed: the submit
   form disappears everywhere and only final results show.
6. Back in the **admin dashboard**, the survey moves from Active to Closed,
   and the survey detail page lists every respondent's phone number
   alongside the live/final bubble chart.

## Testing

See [TESTING.md](./TESTING.md) for the full test strategy, how to run
everything locally with one command, and how to read the generated report.

Quick version:

```bash
./scripts/run-tests.sh
```

## Deploying to EC2

See [deploy/README.md](./deploy/README.md) for the one-time instance setup
and the deploy script. Short version:

```bash
cp deploy/.env.deploy.example deploy/.env.deploy   # fill in EC2_HOST / EC2_SSH_KEY
cp .env.example .env                                # fill in real prod secrets
./deploy/deploy-to-ec2.sh
```

This runs the local test suite first (deploy aborts if tests fail), then
syncs the source to the instance, builds the same three containers there,
and starts them behind the Elastic IP on port 80 — no domain name needed.

## Design notes / defaults applied

- Fuzzy-match threshold: Dice coefficient ≥ 0.8 (`FUZZY_MATCH_THRESHOLD` env var).
- OTP: 6 digits, 2-minute expiry, one active code per phone (`OTP_EXPIRY_MINUTES`).
- One response per `(question, phone_number)` — enforced by a DB unique
  constraint and rejected at the API level with a 409 if violated.
- Admin auth: single hardcoded account via `ADMIN_USERNAME` / `ADMIN_PASSWORD`,
  seeded into the `admins` table on API startup, JWT-based session (`ADMIN_TOKEN_TTL`).
- Survey status (`active` / `closed`) is derived on every read from
  `start_time + duration_minutes` vs. now — no cron job needed, and past
  results stay frozen automatically once the window closes (the API stops
  accepting new responses for closed surveys).
