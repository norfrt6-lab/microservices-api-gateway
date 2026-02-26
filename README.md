# Microservices API Gateway

A production-grade microservices architecture featuring an API gateway with comprehensive distributed system patterns, observability, and Kubernetes deployment.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Gateway** | Node.js, Express, TypeScript |
| **Messaging** | NATS (pub/sub + request/reply + dead letter queue) |
| **Database** | PostgreSQL (per-service isolation) + Prisma ORM |
| **Caching & Rate Limiting** | Redis (token-bucket + response cache + idempotency) |
| **Auth** | JWT + RBAC (admin/user roles) |
| **Validation** | Zod (gateway + service-level defense in depth) |
| **Tracing** | OpenTelemetry + Jaeger (OTLP export) |
| **Metrics** | Prometheus + Grafana (auto-provisioned dashboards) |
| **Deployment** | Docker Compose (dev) + Kubernetes (prod) |
| **Monorepo** | npm workspaces (5 packages) |

## Architecture

```
                          ┌──────────────┐
                          │  Client/User │
                          └──────┬───────┘
                                 │ HTTPS
                          ┌──────▼───────┐
                          │   Ingress /   │
                          │  Load Balancer│
                          └──────┬───────┘
                                 │
                ┌────────────────▼──────────────────┐
                │  API Gateway (v1 deprecated, v2)   │
                │                                    │
                │  • JWT Auth + RBAC                 │
                │  • Rate Limiting (Redis)            │
                │  • Circuit Breaker                  │
                │  • Response Caching                 │
                │  • Idempotency (Redis)              │
                │  • Input Validation (Zod)           │
                │  • Correlation ID Propagation       │
                │  • Prometheus Metrics               │
                │  • OpenTelemetry Tracing            │
                └──┬──────────┬──────────┬───────────┘
                   │    NATS Message Bus  │
      ┌────────────┘          │          └────────────┐
      │                       │                       │
┌─────▼──────┐    ┌──────────▼──────┐    ┌───────────▼───────┐
│ User Service│    │ Product Service │    │  Order Service    │
│  (Express)  │    │  (Express)     │    │  (Express)        │
│  PostgreSQL │    │  PostgreSQL    │    │  PostgreSQL       │
│  bcrypt/JWT │    │  Optimistic    │    │  Saga Pattern     │
│             │    │  Locking       │    │  Idempotency Keys │
└─────────────┘    └────────────────┘    └───────────────────┘
      │                       │                       │
┌─────▼───────────────────────▼───────────────────────▼──────┐
│                  Observability Stack                        │
│    Prometheus  │  Grafana  │  Jaeger  │  Structured Logs   │
└────────────────────────────────────────────────────────────┘
```

## Project Structure

```
microservices-api-gateway/
├── gateway/                    # API Gateway
│   └── src/
│       ├── config/             # Zod-validated env config
│       ├── middleware/         # auth, rateLimiter, circuitBreaker, cache,
│       │                      # metrics, idempotency, requestId, logger
│       ├── routes/             # versioned proxy, health, metrics
│       ├── services/           # redis, nats, discovery
│       ├── telemetry/          # OTel tracer, Prometheus meter
│       └── utils/              # errors, response format
├── services/
│   ├── user-service/           # Auth, user CRUD, NATS responder
│   ├── product-service/        # Product CRUD, stock management, NATS
│   └── order-service/          # Order CRUD, saga orchestrator, NATS events
├── shared/                     # Shared types, constants, schemas, NATS client
├── infra/
│   ├── docker/                 # Prometheus config, Grafana provisioning, init SQL
│   └── k8s/                    # Kubernetes manifests (deployments, HPA, ingress, etc.)
├── scripts/                    # Smoke tests, seed script
├── docker-compose.yml          # Production Docker Compose
└── docker-compose.dev.yml      # Dev Docker Compose (hot-reload)
```

## Getting Started

### Prerequisites

- Docker & Docker Compose
- Node.js 20+ (for local development)
- kubectl (for Kubernetes deployment)

### Development (Docker Compose)

```bash
# Start all services with hot-reload
docker compose -f docker-compose.dev.yml up

# Gateway:          http://localhost:3000
# Jaeger UI:        http://localhost:16686
# Prometheus:       http://localhost:9090
# Grafana:          http://localhost:3100 (admin/admin)
# NATS Monitor:     http://localhost:8222
```

### Production (Docker Compose)

```bash
docker compose up --build
```

### Production (Kubernetes)

```bash
# Create namespace and apply all manifests
kubectl apply -f infra/k8s/namespace.yaml
kubectl apply -f infra/k8s/secrets/
kubectl apply -f infra/k8s/postgres/
kubectl apply -f infra/k8s/redis/
kubectl apply -f infra/k8s/nats/
kubectl apply -f infra/k8s/observability/
kubectl apply -f infra/k8s/gateway/
kubectl apply -f infra/k8s/user-service/
kubectl apply -f infra/k8s/product-service/
kubectl apply -f infra/k8s/order-service/
kubectl apply -f infra/k8s/network-policy.yaml
```

### Smoke Tests

```bash
chmod +x scripts/test-gateway.sh
./scripts/test-gateway.sh http://localhost:3000
```

## API Reference

### Auth (User Service)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/v1/auth/register` | No | Register a new user |
| POST | `/api/v1/auth/login` | No | Login and receive JWT |
| GET | `/api/v1/users/profile` | Yes | Get current user profile |
| GET | `/api/v1/users` | Admin | List all users |

### Products (Product Service)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/v1/products` | No | List products (pagination, search) |
| GET | `/api/v1/products/:id` | No | Get single product |
| POST | `/api/v1/products` | Admin | Create product |
| PUT | `/api/v1/products/:id` | Admin | Update product (optimistic locking) |
| DELETE | `/api/v1/products/:id` | Admin | Soft-delete product |

### Orders (Order Service)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/v1/orders` | Yes | Create order (saga: stock → payment → confirm) |
| GET | `/api/v1/orders` | Yes | List user's orders |
| GET | `/api/v1/orders/:id` | Yes | Get single order |
| POST | `/api/v1/orders/:id/confirm` | Yes | Confirm an order |
| POST | `/api/v1/orders/:id/cancel` | Yes | Cancel an order (releases stock) |

### Gateway

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/health` | Deep health check (Redis, NATS, all services) |
| GET | `/health/live` | Liveness probe |
| GET | `/metrics` | Prometheus metrics |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Gateway port |
| `NODE_ENV` | `development` | Environment |
| `JWT_SECRET` | — | JWT signing secret |
| `GATEWAY_SECRET` | — | Internal gateway-to-service auth |
| `REDIS_URL` | `redis://redis:6379` | Redis connection URL |
| `NATS_URL` | `nats://nats:4222` | NATS connection URL |
| `USER_SERVICE_URL` | `http://user-service:3001` | User service URL |
| `PRODUCT_SERVICE_URL` | `http://product-service:3002` | Product service URL |
| `ORDER_SERVICE_URL` | `http://order-service:3003` | Order service URL |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://jaeger:4318` | OTel trace endpoint |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | Rate limit per minute (anonymous) |
| `RATE_LIMIT_AUTHENTICATED_MAX` | `500` | Rate limit per minute (authenticated) |

## Design Decisions

| Decision | Choice | Reasoning |
|----------|--------|-----------|
| Message Broker | NATS | Lightweight, built-in request/reply, no external dependencies |
| DB per Service | PostgreSQL (separate DBs) | True data isolation between services |
| ORM | Prisma | Type-safe, great DX with TypeScript, auto migrations |
| Auth | JWT (gateway-level) | Stateless, scalable, gateway handles verification |
| Rate Limiting | Redis token-bucket (Lua) | Atomic, shared state across gateway instances |
| Circuit Breaker | Custom implementation | Educational value, per-service tracking |
| Input Validation | Zod | Runtime + compile-time safety, composable schemas |
| Tracing | OpenTelemetry + Jaeger | Vendor-neutral CNCF standard |
| Metrics | Prometheus + Grafana | Industry standard, native K8s integration |
| Transactions | Saga (orchestrator) | Avoids 2PC complexity, clear compensation flow |
| Idempotency | Redis + DB (dual-layer) | Gateway caches responses, DB enforces uniqueness |
| Deployment | Kubernetes | Auto-scaling, self-healing, rolling deploys |
| Secrets | K8s Secrets (Sealed Secrets) | Git-safe encrypted secrets |
| API Versioning | URL-based (`/api/v1/`, `/api/v2/`) | v1 deprecated via headers; v2 current |

## Observability Guide

### Grafana Dashboards

Access Grafana at `http://localhost:3100` (admin/admin). Auto-provisioned dashboards:

- **Gateway Overview** — request rate, error rate, latency percentiles (p50/p95/p99), circuit breaker states, cache hit rate, NATS message throughput

### Prometheus Metrics

Available at `GET /metrics` on every service:

- `http_requests_total` — counter by method, route, status code
- `http_request_duration_seconds` — histogram with percentile buckets
- `circuit_breaker_state` — gauge per service (0=closed, 1=open, 2=half_open)
- `nats_messages_total` — counter by subject and direction
- `rate_limit_hits_total` — counter by tier
- `cache_hits_total` / `cache_misses_total` — counters
- `orders_created_total` / `users_registered_total` — business metrics

### Jaeger Tracing

Access Jaeger UI at `http://localhost:16686`. Traces propagate across:
- HTTP requests (gateway → service)
- NATS messages (correlation ID in headers)

### Structured Logging

All logs are JSON format with: `correlationId`, `service`, `level`, `timestamp`, `method`, `url`, `statusCode`, `responseTime`.

## SLO Targets

| Metric | Target |
|--------|--------|
| Gateway latency (proxy overhead) | p99 < 200ms |
| Service availability | 99.9% uptime |
| Error rate | < 0.1% 5xx responses |
| NATS message processing | p99 < 100ms |

## Kubernetes Deployment

### Scaling

- **Gateway**: 2–10 replicas, HPA scales at 70% CPU
- **Services**: 2–5 replicas each, HPA scales at 70% CPU
- All deployments use `maxSurge: 1, maxUnavailable: 0` for zero-downtime rollouts

### Network Policies

- Services only accept traffic from the gateway pod
- PostgreSQL only accepts connections from service pods
- Redis only accepts connections from gateway and order-service
- NATS accepts connections from all services and gateway

### Probes

- **Readiness**: `GET /health` (5s interval)
- **Liveness**: `GET /health/live` (10s interval)
- **Startup**: 30s initial delay, 5s interval, 10 failure threshold
