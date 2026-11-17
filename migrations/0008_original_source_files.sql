-- Preserve the exact original document in private Cloudflare R2 storage.
-- Extracted text remains separate and is used only for AI study generation.
ALTER TABLE learning_materials ADD COLUMN original_object_key TEXT;
ALTER TABLE learning_materials ADD COLUMN original_size_bytes INTEGER;
