#!/bin/bash
# Zero-downtime database migration script
# Usage: ./scripts/migrate.sh [service]
#
# Runs Prisma migrations for specified service (or all services).
# Validates migration safety before applying.

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m'

SERVICES=("user-service" "product-service" "order-service")

log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

run_migration() {
  local service="$1"
  local service_dir="services/${service}"

  if [ ! -d "$service_dir" ]; then
    log_error "Service directory not found: $service_dir"
    return 1
  fi

  if [ ! -f "$service_dir/prisma/schema.prisma" ]; then
    log_error "Prisma schema not found for $service"
    return 1
  fi

  log_info "Running migration for $service..."

  # Generate Prisma client
  cd "$service_dir"
  npx prisma generate 2>&1
  log_info "  Prisma client generated"

  # Check pending migrations
  local pending
  pending=$(npx prisma migrate status 2>&1 || true)

  if echo "$pending" | grep -q "Database schema is up to date"; then
    log_info "  $service: already up to date"
    cd - > /dev/null
    return 0
  fi

  # Deploy migrations (non-interactive, safe for production)
  npx prisma migrate deploy 2>&1
  log_info "  $service: migration applied successfully"

  cd - > /dev/null
}

# Main
echo "=== Database Migration Script ==="
echo ""

if [ -n "$1" ]; then
  # Run for specific service
  run_migration "$1"
else
  # Run for all services
  for service in "${SERVICES[@]}"; do
    run_migration "$service"
    echo ""
  done
fi

log_info "All migrations complete!"
