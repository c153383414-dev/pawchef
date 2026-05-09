-- Run this once in Supabase SQL Editor
-- Adds a 'translations' JSONB column to preset_recipes for zero-AI multilingual content
ALTER TABLE preset_recipes
  ADD COLUMN IF NOT EXISTS translations JSONB DEFAULT NULL;

-- Structure expected:
-- {
--   "zh": { "title": "...", "content": { "steps": [...], "ingredients": [...], ... }, "nutrition": {...} },
--   "fr": { ... },
--   "es": { ... },
--   "ja": { ... },
--   "ko": { ... }
-- }
