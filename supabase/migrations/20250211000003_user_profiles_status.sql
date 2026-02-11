-- Add banner_url to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS banner_url TEXT;

-- Extend user_presence status to include away, dnd (Discord-style)
DO $$
DECLARE
  cname TEXT;
BEGIN
  SELECT conname INTO cname FROM pg_constraint 
  WHERE conrelid = 'user_presence'::regclass AND contype = 'c' 
  AND pg_get_constraintdef(oid) LIKE '%status%' LIMIT 1;
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE user_presence DROP CONSTRAINT %I', cname);
  END IF;
END $$;
ALTER TABLE user_presence ADD CONSTRAINT user_presence_status_check 
  CHECK (status IN ('online', 'offline', 'in-voice', 'away', 'dnd'));

-- User profiles (personal vs work) - for non-guest accounts only
CREATE TABLE IF NOT EXISTS user_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_type TEXT NOT NULL CHECK (profile_type IN ('personal', 'work')),
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  banner_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, profile_type)
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read user_profiles" ON user_profiles;
CREATE POLICY "Anyone can read user_profiles" ON user_profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can insert user_profiles" ON user_profiles;
CREATE POLICY "Anyone can insert user_profiles" ON user_profiles FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Anyone can update user_profiles" ON user_profiles;
CREATE POLICY "Anyone can update user_profiles" ON user_profiles FOR UPDATE USING (true);
