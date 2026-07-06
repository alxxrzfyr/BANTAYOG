-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

-- Add reference_image_url and image_embedding to public.products
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS reference_image_url TEXT,
ADD COLUMN IF NOT EXISTS image_embedding vector(768);

-- Create index for vector similarity search (using HNSW for performance)
CREATE INDEX ON public.products USING hnsw (image_embedding vector_cosine_ops);

-- Create a function to query nearest neighbors
CREATE OR REPLACE FUNCTION match_product_embeddings(
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  name text,
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

-- Create private bucket for reference images (authenticated access only)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
    ('reference-images', 'reference-images', false, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- RLS policies for storage.objects: admin full access, authenticated read access
-- First, ensure admin role can insert
CREATE POLICY admin_insert_reference_images ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'reference-images' AND public.has_role('admin'));

CREATE POLICY admin_update_reference_images ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'reference-images' AND public.has_role('admin'));

CREATE POLICY admin_delete_reference_images ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'reference-images' AND public.has_role('admin'));

CREATE POLICY authenticated_read_reference_images ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'reference-images');
