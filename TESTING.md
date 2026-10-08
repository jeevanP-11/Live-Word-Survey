# Testing

Three layers of coverage, all wired into one local command and into CI:

| Layer | Tool | What it covers |
|---|---|---|
| API (unit) | Jest | Pure logic: word normalization, fuzzy clustering, survey status/slug derivation, input validators |
| API (integration) | Jest + Supertest + a real Postgres | Full HTTP request/response cycle for every route: admin login, survey creation, OTP request/verify, submission (including fuzzy clustering and resubmission rejection), results polling, closed-survey behavior |
| Web (unit) | Vitest + React Testing Library | Components (BubbleChart, StatusBadge, OtpForm, WordSubmitForm) and the `usePolling` hook, with the API client mocked |

There's deliberately no browser-driven end-to-end suite in v1 — the
integration tests already exercise the real database and every route, and
the component tests exercise the real DOM output, which covers the
functional spec without the flakiness/maintenance cost of a full E2E
harness. If that's wanted later, Playwright would slot in next to these
without disrupting anything here.

## Run everything locally, one command

```bash
./scripts/run-tests.sh
```

This is meant to be run after any non-trivial change, before pushing. It:

1. Starts a disposable Postgres container (`docker-compose.test.yml`, port
   `5433`, tmpfs-backed so it's fast and never persists anything).
2. Installs dependencies and runs the **API** suite (`npm run test:ci` in
   `api/`) with JUnit + coverage output.
3. Installs dependencies and runs the **web** suite (`npm run test:ci` in
   `web/`) with JUnit + coverage output.
4. Tears the test database back down.
5. Prints a summary table and copies both JUnit reports into
   `test-results/` at the repo root.
6. Exits non-zero if either suite failed — safe to use as a git hook or a
   deploy gate (`deploy-to-ec2.sh` calls this automatically and refuses to
   ship if it fails).

Flags:

```bash
./scripts/run-tests.sh --keep-db   # leave the test Postgres running afterward, useful when iterating on a failing test
```

### Reading the summary

```
==================== TEST SUMMARY ====================
  API tests:  PASS
  Web tests:  PASS
  Reports:    /path/to/repo/test-results/
========================================================
```

If a suite fails, its section prints ✘ and the full Jest/Vitest output
above the summary shows exactly which test(s) failed and why — that's
enough context to reproduce and fix without re-running anything. The
JUnit XML in `test-results/` is there for tooling (CI dashboards, IDE test
explorers) rather than for reading by hand.

### Running one layer at a time

```bash
# API unit tests only, no DB needed
cd api && npm test -- fuzzy.test.ts survey.test.ts validate.test.ts

# API integration tests, needs the test DB up
docker compose -f ../docker-compose.test.yml up -d --wait
TEST_DATABASE_URL=postgres://survey:survey@localhost:5433/survey_test npm test

# Web tests
cd web && npm test
```

## What happens in CI

`.github/workflows/ci.yml` runs on every push and pull request:

- **`api-tests`** — spins up a Postgres 16 service container, installs
  deps, type-checks, runs the full Jest suite (`npm run test:ci`) with
  JUnit + coverage, and publishes a readable pass/fail report on the PR via
  `dorny/test-reporter` (annotates failing lines directly on the diff).
  Coverage HTML is uploaded as a build artifact.
- **`web-tests`** — same shape: type-check, `npm run test:ci`, a
  production `vite build` as a sanity check that nothing broke the build,
  test report published, coverage uploaded.
- **`build-images`** — after both suites pass, builds the `api` and `web`
  Docker images (the same Dockerfiles used by `docker-compose.yml`) to
  catch any container-specific breakage before it reaches a deploy.

Any test failure fails the whole workflow — the "fix the bug before
merging" gate is the CI status check itself, plus the annotated report on
the PR.

## When a test fails

1. Read the failing assertion in the CI report or local terminal output —
   Jest/Vitest both print the expected vs. actual value directly.
2. Reproduce it locally with the single-file invocations above.
3. Fix the underlying code (not the test) unless the test's expectation
   was actually wrong — the integration tests assert on the documented API
   contract (Section 5 of the spec), so if behavior and contract disagree,
   the code should move to match the contract, not the other way around.
4. Re-run `./scripts/run-tests.sh` until it's green, then push.
