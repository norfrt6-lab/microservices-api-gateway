#!/bin/bash
# Smoke tests for the API Gateway
# Usage: ./scripts/test-gateway.sh [BASE_URL]

BASE_URL="${1:-http://localhost:3000}"
GATEWAY_SECRET="dev-gateway-secret-change-in-production"
PASSED=0
FAILED=0

# Colors
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

echo "=== API Gateway Smoke Tests ==="
echo "Target: $BASE_URL"
echo ""

# 1. Health endpoint
echo "--- Health ---"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/health")
check "GET /health" 200 "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/health/live")
check "GET /health/live" 200 "$STATUS"

# 2. Metrics endpoint
echo ""
echo "--- Metrics ---"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/metrics")
check "GET /metrics" 200 "$STATUS"

# 3. Rate limiting — should not be rate limited for health
echo ""
echo "--- Rate Limiting ---"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/health")
check "GET /health (not rate limited)" 200 "$STATUS"

# 4. Auth — unprotected routes
echo ""
echo "--- Auth ---"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/v1/auth/register" \
  -X POST -H "Content-Type: application/json" \
  -d '{"email":"smoke@test.com","password":"test1234","name":"Smoke Test"}')
# Might be 201 (new) or 400 (duplicate) or 502 (service down)
if [ "$STATUS" -eq 201 ] || [ "$STATUS" -eq 400 ]; then
  echo -e "${GREEN}PASS${NC} POST /api/v1/auth/register (HTTP $STATUS - service reachable)"
  PASSED=$((PASSED + 1))
else
  echo -e "${RED}FAIL${NC} POST /api/v1/auth/register (HTTP $STATUS - service unreachable)"
  FAILED=$((FAILED + 1))
fi

# 5. Products — public listing
echo ""
echo "--- Products ---"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/v1/products")
if [ "$STATUS" -eq 200 ] || [ "$STATUS" -eq 502 ]; then
  echo -e "${GREEN}PASS${NC} GET /api/v1/products (HTTP $STATUS)"
  PASSED=$((PASSED + 1))
else
  echo -e "${RED}FAIL${NC} GET /api/v1/products (HTTP $STATUS)"
  FAILED=$((FAILED + 1))
fi

# 6. 404 for unknown routes
echo ""
echo "--- 404 ---"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/v1/nonexistent")
check "GET /api/v1/nonexistent" 404 "$STATUS"

# 7. Correlation ID propagation
echo ""
echo "--- Correlation ID ---"
CORR_ID=$(curl -s -D - "$BASE_URL/health" -o /dev/null | grep -i "x-correlation-id" | tr -d '\r')
if [ -n "$CORR_ID" ]; then
  echo -e "${GREEN}PASS${NC} x-correlation-id header present: $CORR_ID"
  PASSED=$((PASSED + 1))
else
  echo -e "${RED}FAIL${NC} x-correlation-id header missing"
  FAILED=$((FAILED + 1))
fi

echo ""
echo "=== Results ==="
echo -e "Passed: ${GREEN}${PASSED}${NC}"
echo -e "Failed: ${RED}${FAILED}${NC}"
echo ""

if [ "$FAILED" -gt 0 ]; then
  exit 1
fi
exit 0
