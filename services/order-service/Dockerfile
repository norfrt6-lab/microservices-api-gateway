FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json ./
COPY shared/package.json ./shared/
COPY services/order-service/package.json ./services/order-service/

RUN npm install --workspace=shared --workspace=services/order-service

COPY shared/ ./shared/
COPY services/order-service/ ./services/order-service/
COPY tsconfig.base.json ./

RUN npm run build --workspace=shared && npm run build --workspace=services/order-service
RUN cd services/order-service && npx prisma generate

FROM node:20-alpine AS runner

WORKDIR /app

COPY --from=builder /app/package.json ./
COPY --from=builder /app/shared/package.json ./shared/
COPY --from=builder /app/services/order-service/package.json ./services/order-service/

RUN npm install --workspace=shared --workspace=services/order-service --omit=dev

COPY --from=builder /app/shared/dist/ ./shared/dist/
COPY --from=builder /app/services/order-service/dist/ ./services/order-service/dist/
COPY --from=builder /app/services/order-service/prisma/ ./services/order-service/prisma/
COPY --from=builder /app/services/order-service/generated/ ./services/order-service/generated/

EXPOSE 3003

HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3003/health || exit 1

CMD ["node", "services/order-service/dist/index.js"]
