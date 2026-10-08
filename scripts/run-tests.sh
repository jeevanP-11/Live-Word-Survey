#!/usr/bin/env bash
#
# Runs the full test suite locally: API unit + integration tests (against a
# disposable Postgres container) and the web unit test suite. Produces JUnit
# XML + coverage reports under test-results/, then prints a clear pass/fail
# summary. Exits non-zero if anything fails, so it's safe to use as a
# pre-push / post-big-change gate.
#
# Usage: ./scripts/run-tests.sh [--keep-db]
#   --keep-db   don't tear down the test Postgres container at the end
#               (handy for repeated local runs / debugging a failing test)

set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

KEEP_DB=false
for arg in "$@"; do
  case "$arg" in
    --keep-db) KEEP_DB=true ;;
  esac
done

REPORT_DIR="$ROOT_DIR/test-results"
mkdir -p "$REPORT_DIR"

API_STATUS=0
WEB_STATUS=0
DB_STARTED=false

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
RESET='\033[0m'

log() { echo -e "${BOLD}▸ $1${RESET}"; }
ok()  { echo -e "${GREEN}✔ $1${RESET}"; }
fail(){ echo -e "${RED}✘ $1${RESET}"; }

cleanup() {
  if [ "$DB_STARTED" = true ] && [ "$KEEP_DB" = false ]; then
    log "Tearing down test database..."
    docker compose -f docker-compose.test.yml down -v >/dev/null 2>&1
  fi
}
trap cleanup EXIT

# ---------------------------------------------------------------------------
log "Starting disposable test Postgres (docker-compose.test.yml)..."
if ! docker compose -f docker-compose.test.yml up -d --wait; then
  fail "Could not start the test database. Is Docker running?"
  exit 1
fi
DB_STARTED=true
ok "Test database is up on localhost:5433"

# ---------------------------------------------------------------------------
log "Installing & running API tests (Jest, unit + integration)..."
(
  cd "$ROOT_DIR/api"
  npm install --no-audit --no-fund
  TEST_DATABASE_URL="postgres://survey:survey@localhost:5433/survey_test" npm run test:ci
)
API_STATUS=$?
mkdir -p "$REPORT_DIR"
cp "$ROOT_DIR/api/test-results/api-junit.xml" "$REPORT_DIR/" 2>/dev/null || true

if [ $API_STATUS -eq 0 ]; then
  ok "API tests passed"
else
  fail "API tests FAILED (see output above / test-results/api-junit.xml)"
fi

# ---------------------------------------------------------------------------
log "Installing & running web tests (Vitest)..."
(
  cd "$ROOT_DIR/web"
  npm install --no-audit --no-fund
  npm run test:ci
)
WEB_STATUS=$?
cp "$ROOT_DIR/web/test-results/web-junit.xml" "$REPORT_DIR/" 2>/dev/null || true

if [ $WEB_STATUS -eq 0 ]; then
  ok "Web tests passed"
else
  fail "Web tests FAILED (see output above / test-results/web-junit.xml)"
fi

# ---------------------------------------------------------------------------
echo
echo "==================== TEST SUMMARY ===================="
if [ $API_STATUS -eq 0 ]; then
  echo -e "  API tests:  ${GREEN}PASS${RESET}"
else
  echo -e "  API tests:  ${RED}FAIL${RESET}"
fi
if [ $WEB_STATUS -eq 0 ]; then
  echo -e "  Web tests:  ${GREEN}PASS${RESET}"
else
  echo -e "  Web tests:  ${RED}FAIL${RESET}"
fi
echo "  Reports:    $REPORT_DIR/"
echo "========================================================"

if [ $API_STATUS -ne 0 ] || [ $WEB_STATUS -ne 0 ]; then
  echo
  echo -e "${YELLOW}One or more suites failed. Fix the reported failures before shipping this change.${RESET}"
  exit 1
fi

echo
ok "All suites passed."
exit 0
