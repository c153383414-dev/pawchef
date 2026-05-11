-- ============================================================
-- Fix free_ai_limit default: 3 → 2
-- Run once in Supabase SQL Editor
-- ============================================================

-- 1. Change the column default for future new users
ALTER TABLE profiles ALTER COLUMN free_ai_limit SET DEFAULT 2;

-- 2. Fix existing users who still have the legacy limit of 3
--    and haven't consumed any free quota yet → give them 2
UPDATE profiles
   SET free_ai_limit = 2
 WHERE free_ai_limit = 3
   AND free_ai_used = 0;

-- 3. Fix existing users who have limit=3 and used=1
--    (they used 1 guest recipe but reconciliation wasn't run) → cap limit at 2
UPDATE profiles
   SET free_ai_limit = 2
 WHERE free_ai_limit = 3
   AND free_ai_used >= 1;
