-- Create separate databases for each microservice
CREATE DATABASE users_db;
CREATE DATABASE products_db;
CREATE DATABASE orders_db;

-- Add CHECK constraints if tables already exist (safe to re-run)
\c products_db

DO $$
BEGIN
  IF to_regclass('public.products') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'products_price_positive'
    ) THEN
      ALTER TABLE public.products
        ADD CONSTRAINT products_price_positive CHECK (price > 0);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'products_stock_non_negative'
    ) THEN
      ALTER TABLE public.products
        ADD CONSTRAINT products_stock_non_negative CHECK (stock >= 0);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'products_version_positive'
    ) THEN
      ALTER TABLE public.products
        ADD CONSTRAINT products_version_positive CHECK (version >= 1);
    END IF;
  END IF;
END $$;

\c orders_db

DO $$
BEGIN
  IF to_regclass('public.orders') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'orders_total_positive'
    ) THEN
      ALTER TABLE public.orders
        ADD CONSTRAINT orders_total_positive CHECK (total > 0);
    END IF;
  END IF;
END $$;
