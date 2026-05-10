-- ============================================================
-- Free-Tier AI Recipe Feature Migration
-- Run this once in Supabase SQL Editor
-- ============================================================

-- 1. guest_usage table (tracks unauthenticated free recipe uses)
CREATE TABLE IF NOT EXISTS guest_usage (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token       TEXT NOT NULL,
  ip          TEXT NOT NULL,
  fingerprint TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS guest_usage_token_idx       ON guest_usage(token);
CREATE INDEX IF NOT EXISTS guest_usage_ip_idx          ON guest_usage(ip);
CREATE INDEX IF NOT EXISTS guest_usage_fingerprint_idx ON guest_usage(fingerprint);
CREATE INDEX IF NOT EXISTS guest_usage_created_idx     ON guest_usage(created_at);

ALTER TABLE guest_usage ENABLE ROW LEVEL SECURITY;

-- Service role (used by the API) can do everything
CREATE POLICY "service_role_all_guest_usage" ON guest_usage
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------
-- 2. Add free AI fields to profiles
-- ---------------------------------------------------------------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS free_ai_used  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS free_ai_limit INTEGER NOT NULL DEFAULT 3;

-- Back-fill existing users (give them their 3 free uses starting from 0)
UPDATE profiles SET free_ai_used = 0, free_ai_limit = 3
  WHERE free_ai_used IS NULL OR free_ai_limit IS NULL;

-- ---------------------------------------------------------------
-- 3. Atomic free-AI deduction function (prevents concurrent over-use)
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION deduct_free_ai(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_used  INTEGER;
  v_limit INTEGER;
BEGIN
  SELECT free_ai_used, free_ai_limit
    INTO v_used, v_limit
    FROM profiles
   WHERE id = p_user_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'PROFILE_NOT_FOUND');
  END IF;

  IF v_used >= v_limit THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'FREE_LIMIT_REACHED');
  END IF;

  UPDATE profiles
     SET free_ai_used = free_ai_used + 1
   WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'ok',        true,
    'used',      v_used + 1,
    'limit',     v_limit,
    'remaining', v_limit - v_used - 1
  );
END;
$$;

-- ---------------------------------------------------------------
-- 4. Cleanup function: delete guest_usage older than 30 days
--    Call this via pg_cron or manually:  SELECT cleanup_guest_usage();
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION cleanup_guest_usage()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM guest_usage
   WHERE created_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- ---------------------------------------------------------------
-- 5. Update handle_new_user trigger to initialise free_ai fields
--    (Only if your existing trigger inserts into profiles)
-- ---------------------------------------------------------------
-- If you have an existing handle_new_user function, add these lines
-- to its INSERT or UPDATE statement:
--   free_ai_used  = 0,
--   free_ai_limit = 3
--
-- Example (adjust to match your existing trigger body):
-- CREATE OR REPLACE FUNCTION public.handle_new_user()
-- RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
-- BEGIN
--   INSERT INTO public.profiles (id, email, display_name, free_ai_used, free_ai_limit)
--   VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'display_name', 0, 3)
--   ON CONFLICT (id) DO NOTHING;
--   RETURN NEW;
-- END;
-- $$;
