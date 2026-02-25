# Microservices API Gateway

A production-grade microservices architecture with API gateway, service discovery, and distributed system patterns.

## Tech Stack

- **Gateway:** Node.js, Express, TypeScript
- **Messaging:** NATS (pub/sub + request/reply)
- **Database:** PostgreSQL (per-service isolation) + Prisma ORM
- **Caching & Rate Limiting:** Redis
- **Auth:** JWT + RBAC
- **Validation:** Zod
- **Observability:** OpenTelemetry, Prometheus, Grafana, Jaeger
- **Deployment:** Docker, Kubernetes (HPA, rolling deploys, network policies)

## Architecture

```
Client → Ingress → API Gateway (auth, rate limit, circuit breaker, tracing)
                        ↓ NATS Message Bus
           ┌────────────┼────────────┐
      User Service  Product Svc  Order Svc
      (PostgreSQL)  (PostgreSQL)  (PostgreSQL)
                        ↓
              Observability Stack
     (Prometheus + Grafana + Jaeger)
```

## Key Patterns

- **Circuit Breaker** — protect against cascading failures
- **Saga Pattern** — orchestrated distributed transactions with compensation
- **Idempotency Keys** — prevent duplicate side effects
- **Exponential Backoff** — retry with jitter for transient failures
- **API Versioning** — URL-based (`/api/v1/`, `/api/v2/`)
- **Service Discovery** — NATS-based registration + heartbeats

## Getting Started

```bash
# Development
docker compose -f docker-compose.dev.yml up

# Production (Kubernetes)
kubectl apply -f infra/k8s/
```
