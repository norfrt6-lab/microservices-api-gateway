# Contributing

## Prerequisites

- Node.js >= 20
- Docker & Docker Compose
- Git

## Setup

```bash
git clone <repo-url>
cd microservices-api-gateway
npm install
cp .env.example .env
```

## Development

```bash
# Start infrastructure (Postgres, Redis, NATS, observability)
docker compose -f docker-compose.dev.yml up -d

# Run database migrations
bash scripts/migrate.sh

# Seed test data
npm run seed

# Start individual services
npm run dev:gateway
npm run dev:user
npm run dev:product
npm run dev:order
```

## Branch Strategy

- `main` — production release
- `dev` — integration branch
- `feat/*` — feature branches (branch from `dev`, PR into `dev`)

## Testing

```bash
# Run all tests
npm test

# Run tests for a specific workspace
npm test --workspace=gateway
npm test --workspace=shared

# Run with coverage
npx vitest run --coverage --workspace=gateway
```

```bash
# Integration tests (Docker Compose)
make test-integration

# If make is not available
npm run test:integration
```

### Security Scanning (CI)

CI runs SCA (`npm audit`), generates an SBOM (`sbom.spdx.json`), and performs container image scans (Trivy).

## Code Style

- TypeScript strict mode
- ESLint with typescript-eslint
- Structured logging with pino (no `console.log`)
- Zod schemas for all input validation

```bash
npm run lint
```

## Adding a New Service

1. Create `services/<name>/` with `package.json`, `tsconfig.json`, `Dockerfile`, `Dockerfile.dev`
2. Add Prisma schema in `services/<name>/prisma/schema.prisma`
3. Register in root `package.json` workspaces array
4. Add NATS subjects to `shared/src/constants/index.ts`
5. Add routes to `gateway/src/config/routes.config.ts`
6. Add K8s manifests in `infra/k8s/<name>/`
7. Add to `docker-compose.yml` and `docker-compose.dev.yml`
8. Add to Prometheus scrape config in `infra/docker/prometheus.yml`

## API Documentation

Swagger UI is available at `GET /docs` when the gateway is running.
The raw OpenAPI spec is at `GET /docs/openapi.json`.
