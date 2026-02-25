FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json ./
COPY shared/package.json ./shared/
COPY services/user-service/package.json ./services/user-service/

RUN npm install --workspace=shared --workspace=services/user-service

COPY shared/ ./shared/
COPY services/user-service/ ./services/user-service/
COPY tsconfig.base.json ./

RUN npm run build --workspace=shared && npm run build --workspace=services/user-service
RUN cd services/user-service && npx prisma generate

FROM node:20-alpine AS runner

WORKDIR /app

COPY --from=builder /app/package.json ./
COPY --from=builder /app/shared/package.json ./shared/
COPY --from=builder /app/services/user-service/package.json ./services/user-service/

RUN npm install --workspace=shared --workspace=services/user-service --omit=dev

COPY --from=builder /app/shared/dist/ ./shared/dist/
COPY --from=builder /app/services/user-service/dist/ ./services/user-service/dist/
COPY --from=builder /app/services/user-service/prisma/ ./services/user-service/prisma/
COPY --from=builder /app/services/user-service/node_modules/.prisma/ ./services/user-service/node_modules/.prisma/

EXPOSE 3001

HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "services/user-service/dist/index.js"]
