-- Ensure UUID generation is available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create enum for order status (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrderStatus') THEN
    CREATE TYPE "OrderStatus" AS ENUM (
      'PENDING',
      'STOCK_RESERVED',
      'CONFIRMED',
      'CANCELLED',
      'FAILED'
    );
  END IF;
END $$;

-- Create orders table (idempotent)
CREATE TABLE IF NOT EXISTS "orders" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL,
  "items" JSONB NOT NULL,
  "total" DECIMAL(10, 2) NOT NULL,
  "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
  "sagaStep" TEXT,
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- Add check constraint if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_total_positive'
  ) THEN
    ALTER TABLE "orders"
      ADD CONSTRAINT "orders_total_positive" CHECK ("total" > 0);
  END IF;
END $$;

-- Indexes (idempotent)
CREATE INDEX IF NOT EXISTS "orders_userId_idx" ON "orders" ("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "orders_idempotencyKey_key" ON "orders" ("idempotencyKey");
