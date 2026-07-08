-- Migration: 00010_market_prices

-- Enable pg_trgm extension if not already enabled (useful for text searching)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE public.market_prices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  commodity_name TEXT NOT NULL,
  local_name TEXT,
  category TEXT,
  unit TEXT NOT NULL,
  price_min NUMERIC NOT NULL,
  price_max NUMERIC NOT NULL,
  market_location TEXT DEFAULT 'National',
  source TEXT NOT NULL,
  as_of_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.market_prices ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users (and merchants) to select
CREATE POLICY "Allow authenticated read access to market_prices"
ON public.market_prices FOR SELECT
TO authenticated
USING (true);

-- Index for fuzzy text searching by commodity name or local name
CREATE INDEX idx_market_prices_commodity_trgm ON public.market_prices USING GIN (commodity_name gin_trgm_ops);
CREATE INDEX idx_market_prices_local_name_trgm ON public.market_prices USING GIN (local_name gin_trgm_ops);

-- Unique constraint to avoid duplicating the same commodity from the same source on the same date for the same location
ALTER TABLE public.market_prices ADD CONSTRAINT unique_market_price_record UNIQUE (commodity_name, market_location, source, as_of_date);
