-- =============================================================================
-- Migration: Add Image Embeddings for Vision Validation
-- Description: Enables pgvector and adds a 768-dimensional vector column to 
--              the products table for Gemini image embeddings.
-- =============================================================================

-- 1. Enable the vector extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

-- 2. Add the embedding column
-- Gemini embedding-2-preview returns 768 dimensions
ALTER TABLE public.products ADD COLUMN image_embedding vector(768);

-- 3. Create an HNSW index for fast nearest-neighbor search
-- Uses cosine distance (vector_cosine_ops)
CREATE INDEX IF NOT EXISTS products_image_embedding_idx 
    ON public.products 
    USING hnsw (image_embedding vector_cosine_ops);
