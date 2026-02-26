#!/bin/bash
# Integration tests for Docker Compose flow
# Usage: ./scripts/integration-test.sh [BASE_URL]
set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"
PASSED=0
FAILED=0

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

CURL_MAX_TIME="${CURL_MAX_TIME:-15}"
CURL_RETRY="${CURL_RETRY:-3}"
CURL_RETRY_DELAY="${CURL_RETRY_DELAY:-1}"

curl_request() {
  curl -s --max-time "$CURL_MAX_TIME" --retry "$CURL_RETRY" --retry-delay "$CURL_RETRY_DELAY" --retry-connrefused "$@"
}

curl_status() {
  local code
  code=$(curl_request -o /dev/null -w "%{http_code}" "$@" 2>/dev/null || true)
  if [ -z "$code" ]; then
    code="000"
  fi
  echo "$code"
}

check() {
  local name="$1"
  local expected_status="$2"
  local actual_status="$3"

  if [ "$actual_status" -eq "$expected_status" ]; then
    echo -e "${GREEN}PASS${NC} $name (HTTP $actual_status)"
    PASSED=$((PASSED + 1))
  else
    echo -e "${RED}FAIL${NC} $name (expected $expected_status, got $actual_status)"
    FAILED=$((FAILED + 1))
  fi
}

echo "=== Integration Tests (Docker Compose) ==="
echo "Target: $BASE_URL"
echo ""

# Optional: run Prisma migrations before tests (requires DB URLs)
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "--- Migrations ---"
  if [ -n "${USER_DB_URL:-}" ] || [ -n "${PRODUCT_DB_URL:-}" ] || [ -n "${ORDER_DB_URL:-}" ]; then
    [ -n "${USER_DB_URL:-}" ] && npm run db:migrate --workspace=services/user-service
    [ -n "${PRODUCT_DB_URL:-}" ] && npm run db:migrate --workspace=services/product-service
    [ -n "${ORDER_DB_URL:-}" ] && npm run db:migrate --workspace=services/order-service
  else
    echo "SKIP migrations (database URLs not set)"
  fi
  echo ""
fi

# 1) Health endpoints
echo "--- Health ---"
STATUS=$(curl_status "$BASE_URL/health")
check "GET /health" 200 "$STATUS"

STATUS=$(curl_status "$BASE_URL/health/live")
check "GET /health/live" 200 "$STATUS"

# 2) Metrics endpoint
echo ""
echo "--- Metrics ---"
STATUS=$(curl_status "$BASE_URL/metrics")
check "GET /metrics" 200 "$STATUS"

# 3) Register + Login
echo ""
echo "--- Auth (register + login) ---"
EMAIL="int-$(date +%s)@test.com"
PASSWORD="test1234"
NAME="Integration Test"

REGISTER_STATUS=$(curl_status "$BASE_URL/api/v1/auth/register" \
  -X POST -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"name\":\"$NAME\"}")

# 201 for new, 400 for duplicate validation
if [ "$REGISTER_STATUS" -eq 201 ] || [ "$REGISTER_STATUS" -eq 400 ]; then
  echo -e "${GREEN}PASS${NC} POST /api/v1/auth/register (HTTP $REGISTER_STATUS)"
  PASSED=$((PASSED + 1))
else
  echo -e "${RED}FAIL${NC} POST /api/v1/auth/register (HTTP $REGISTER_STATUS)"
  FAILED=$((FAILED + 1))
fi

LOGIN_JSON=$(curl_request "$BASE_URL/api/v1/auth/login" \
  -X POST -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" || true)

TOKEN=$(echo "$LOGIN_JSON" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')

if [ -n "$TOKEN" ]; then
  echo -e "${GREEN}PASS${NC} POST /api/v1/auth/login (token issued)"
  PASSED=$((PASSED + 1))
else
  echo -e "${RED}FAIL${NC} POST /api/v1/auth/login (no token)"
  FAILED=$((FAILED + 1))
fi

# 4) Products list (public)
echo ""
echo "--- Products (public) ---"
STATUS=$(curl_status "$BASE_URL/api/v1/products")
check "GET /api/v1/products" 200 "$STATUS"

# 5) Create product (E2E flow)
echo ""
echo "--- Product create (E2E) ---"
PRODUCT_JSON=$(curl_request "$BASE_URL/api/v1/products" \
  -X POST -H "Content-Type: application/json" \
  -d "{\"name\":\"E2E Product\",\"description\":\"E2E Test\",\"price\":19.99,\"stock\":5}" || true)

PRODUCT_ID=$(echo "$PRODUCT_JSON" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
if [ -n "$PRODUCT_ID" ]; then
  echo -e "${GREEN}PASS${NC} POST /api/v1/products (product created)"
  PASSED=$((PASSED + 1))
else
  echo -e "${RED}FAIL${NC} POST /api/v1/products (no product id)"
  FAILED=$((FAILED + 1))
fi

# 6) Orders (E2E flow)
echo ""
echo "--- Orders (authenticated) ---"
if [ -n "$TOKEN" ] && [ -n "$PRODUCT_ID" ]; then
  ORDER_JSON=$(curl_request "$BASE_URL/api/v1/orders" \
      -X POST -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d "{\"items\":[{\"productId\":\"$PRODUCT_ID\",\"quantity\":1}]}" || true)

  ORDER_ID=$(echo "$ORDER_JSON" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
  if [ -n "$ORDER_ID" ]; then
    echo -e "${GREEN}PASS${NC} POST /api/v1/orders (order created)"
    PASSED=$((PASSED + 1))
  else
    echo -e "${RED}FAIL${NC} POST /api/v1/orders (no order id)"
    FAILED=$((FAILED + 1))
  fi

  ORDER_STATUS=$(curl_status "$BASE_URL/api/v1/orders" \
      -H "Authorization: Bearer $TOKEN")
  check "GET /api/v1/orders" 200 "$ORDER_STATUS"

  if [ -n "$ORDER_ID" ]; then
    STATUS=$(curl_status "$BASE_URL/api/v1/orders/$ORDER_ID" \
          -H "Authorization: Bearer $TOKEN")
    check "GET /api/v1/orders/:id" 200 "$STATUS"

    STATUS=$(curl_status "$BASE_URL/api/v1/orders/$ORDER_ID/confirm" \
          -X POST \
          -H "Authorization: Bearer $TOKEN")
    check "POST /api/v1/orders/:id/confirm" 200 "$STATUS"

    STATUS=$(curl_status "$BASE_URL/api/v1/orders/$ORDER_ID/cancel" \
          -X POST \
          -H "Authorization: Bearer $TOKEN")
    check "POST /api/v1/orders/:id/cancel" 200 "$STATUS"
  fi
else
  echo -e "${RED}SKIP${NC} Orders flow (missing token or product id)"
  FAILED=$((FAILED + 1))
fi

# 6) 404 routing
echo ""
echo "--- 404 ---"
STATUS=$(curl_status "$BASE_URL/api/v1/nonexistent")
check "GET /api/v1/nonexistent" 404 "$STATUS"

echo ""
echo "=== Results ==="
echo -e "Passed: ${GREEN}${PASSED}${NC}"
echo -e "Failed: ${RED}${FAILED}${NC}"
echo ""

if [ "$FAILED" -gt 0 ]; then
  exit 1
fi
exit 0
