-- =============================================================================
-- Migration: Add match_product_embeddings RPC
-- Description: Creates the Postgres function that performs cosine similarity
--              search against the image_embedding vector column.
-- =============================================================================

DROP FUNCTION IF EXISTS public.match_product_embeddings(vector, float, int);
DROP FUNCTION IF EXISTS public.match_product_embeddings(vector, double precision, integer);

CREATE OR REPLACE FUNCTION public.match_product_embeddings(
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  name text,
  category text,
  eligibility_status text,
  price_range_min numeric,
  price_range_max numeric,
  reference_image_url text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    id,
    name,
    category,
    eligibility_status,
    price_range_min,
    price_range_max,
    reference_image_url,
    1 - (image_embedding <=> query_embedding) AS similarity
  FROM public.products
  WHERE 1 - (image_embedding <=> query_embedding) > match_threshold
    AND image_embedding IS NOT NULL
  ORDER BY image_embedding <=> query_embedding
  LIMIT match_count;
$$;
