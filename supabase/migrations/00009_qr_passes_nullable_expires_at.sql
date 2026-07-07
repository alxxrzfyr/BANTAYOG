-- Make qr_passes.expires_at nullable since QR passes are now permanent
ALTER TABLE public.qr_passes ALTER COLUMN expires_at DROP NOT NULL;
