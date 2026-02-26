FROM node:20-slim AS builder

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
COPY package-lock.json ./
COPY shared/package.json ./shared/
COPY services/product-service/package.json ./services/product-service/

RUN npm ci --workspace=shared --workspace=services/product-service

COPY shared/ ./shared/
COPY services/product-service/ ./services/product-service/
COPY tsconfig.base.json ./

RUN npm run build --workspace=shared && npm run build --workspace=services/product-service
RUN cd services/product-service && npx prisma generate

FROM node:20-slim AS runner

RUN apt-get update -y && apt-get install -y openssl wget && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./
COPY --from=builder /app/shared/package.json ./shared/
COPY --from=builder /app/services/product-service/package.json ./services/product-service/

RUN npm ci --workspace=shared --workspace=services/product-service --omit=dev

COPY --from=builder /app/shared/dist/ ./shared/dist/
COPY --from=builder /app/services/product-service/dist/ ./services/product-service/dist/
COPY --from=builder /app/services/product-service/prisma/ ./services/product-service/prisma/
COPY --from=builder /app/services/product-service/generated/ ./services/product-service/generated/

EXPOSE 3002

HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3002/health || exit 1

CMD ["node", "services/product-service/dist/index.js"]
