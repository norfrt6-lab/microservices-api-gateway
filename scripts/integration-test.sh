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

# 1) Health endpoints
echo "--- Health ---"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/health")
check "GET /health" 200 "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/health/live")
check "GET /health/live" 200 "$STATUS"

# 2) Metrics endpoint
echo ""
echo "--- Metrics ---"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/metrics")
check "GET /metrics" 200 "$STATUS"

# 3) Register + Login
echo ""
echo "--- Auth (register + login) ---"
EMAIL="int-$(date +%s)@test.com"
PASSWORD="test1234"
NAME="Integration Test"

REGISTER_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/v1/auth/register" \
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

LOGIN_JSON=$(curl -s "$BASE_URL/api/v1/auth/login" \
  -X POST -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

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
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/v1/products")
check "GET /api/v1/products" 200 "$STATUS"

# 5) Orders (requires auth via gateway)
echo ""
echo "--- Orders (authenticated) ---"
if [ -n "$TOKEN" ]; then
  ORDER_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/v1/orders" \
    -H "Authorization: Bearer $TOKEN")
  # If no orders, still 200 with empty list
  check "GET /api/v1/orders" 200 "$ORDER_STATUS"
else
  echo -e "${RED}SKIP${NC} GET /api/v1/orders (no token)"
  FAILED=$((FAILED + 1))
fi

# 6) 404 routing
echo ""
echo "--- 404 ---"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/v1/nonexistent")
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
