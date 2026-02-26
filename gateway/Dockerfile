FROM node:20-bookworm-slim AS builder

WORKDIR /app

COPY package.json ./
COPY package-lock.json ./
COPY shared/package.json ./shared/
COPY gateway/package.json ./gateway/

RUN npm ci --workspace=shared --workspace=gateway

COPY shared/ ./shared/
COPY gateway/ ./gateway/
COPY tsconfig.base.json ./

RUN npm run build --workspace=shared && npm run build --workspace=gateway

FROM node:20-bookworm-slim AS runner

WORKDIR /app

RUN apt-get update -y && apt-get install -y wget && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./
COPY --from=builder /app/shared/package.json ./shared/
COPY --from=builder /app/gateway/package.json ./gateway/

RUN npm ci --workspace=shared --workspace=gateway --omit=dev

COPY --from=builder /app/shared/dist/ ./shared/dist/
COPY --from=builder /app/gateway/dist/ ./gateway/dist/

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/health/live || exit 1

CMD ["node", "gateway/dist/index.js"]
