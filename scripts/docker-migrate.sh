#!/usr/bin/env bash
# Docker-based migration helper for Compose databases
# Usage:
#   ./scripts/docker-migrate.sh                 # migrate all services
#   ./scripts/docker-migrate.sh user-service    # migrate a single service
#
# This applies the SQL migration files directly inside the running Postgres container.

set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"

SERVICES=("user-service" "product-service" "order-service")

declare -A DB_MAP=(
  ["user-service"]="users_db"
  ["product-service"]="products_db"
  ["order-service"]="orders_db"
)

declare -A MIGRATION_MAP=(
  ["user-service"]="services/user-service/prisma/migrations/20250101000000_init/migration.sql"
  ["product-service"]="services/product-service/prisma/migrations/20250101000000_init/migration.sql"
  ["order-service"]="services/order-service/prisma/migrations/20250101000000_init/migration.sql"
)

log_info() { echo "[INFO] $1"; }
log_warn() { echo "[WARN] $1"; }
log_error() { echo "[ERROR] $1" >&2; }

usage() {
  cat <<EOF
Docker-based migration helper

Usage:
  ./scripts/docker-migrate.sh                 # migrate all services
  ./scripts/docker-migrate.sh <service>       # migrate a single service

Services:
  user-service
  product-service
  order-service

Optional:
  COMPOSE_FILE=path/to/docker-compose.yml
EOF
}

require_postgres_container() {
  local id
  id="$(docker compose -f "$COMPOSE_FILE" ps -q postgres)"
  if [[ -z "${id}" ]]; then
    log_error "Postgres container not found. Is the stack running?"
    exit 1
  fi
}

ensure_database() {
  local db="$1"
  local exists
  exists="$(docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${db}';" | tr -d '[:space:]')"
  if [[ "${exists}" != "1" ]]; then
    log_warn "Database ${db} not found. Creating..."
    docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U postgres -c "CREATE DATABASE ${db};" >/dev/null
    log_info "Database ${db} created."
  fi
}

apply_migration() {
  local service="$1"
  local db="${DB_MAP[$service]:-}"
  local migration="${MIGRATION_MAP[$service]:-}"

  if [[ -z "${db}" || -z "${migration}" ]]; then
    log_error "Unknown service: ${service}"
    usage
    exit 1
  fi

  if [[ ! -f "${migration}" ]]; then
    log_error "Migration file not found: ${migration}"
    exit 1
  fi

  log_info "Applying migration for ${service} → ${db}"
  ensure_database "${db}"

  docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U postgres -d "${db}" -v ON_ERROR_STOP=1 < "${migration}"
  log_info "Migration applied for ${service}"
}

main() {
  if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    usage
    exit 0
  fi

  require_postgres_container

  if [[ -n "${1:-}" ]]; then
    apply_migration "${1}"
  else
    for svc in "${SERVICES[@]}"; do
      apply_migration "${svc}"
      echo ""
    done
  fi

  log_info "All migrations complete."
}

main "$@"
