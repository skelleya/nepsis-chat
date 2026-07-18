-- Privacy settings, active server profile, and per-friend profile visibility

-- Which profile is used when joining / appearing in servers
ALTER TABLE users ADD COLUMN IF NOT EXISTS active_profile TEXT DEFAULT 'personal';
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_active_profile_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_active_profile_check
      CHECK (active_profile IS NULL OR active_profile IN ('personal', 'work'));
  END IF;
END $$;

-- Voice-focused privacy & safety preferences
CREATE TABLE IF NOT EXISTS user_privacy_settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  who_can_dm TEXT NOT NULL DEFAULT 'friends'
    CHECK (who_can_dm IN ('everyone', 'friends', 'nobody')),
  who_can_call TEXT NOT NULL DEFAULT 'friends'
    CHECK (who_can_call IN ('everyone', 'friends', 'nobody')),
  who_can_add_friend TEXT NOT NULL DEFAULT 'everyone'
    CHECK (who_can_add_friend IN ('everyone', 'server_members', 'nobody')),
  show_voice_channel TEXT NOT NULL DEFAULT 'everyone'
    CHECK (show_voice_channel IN ('everyone', 'friends', 'nobody')),
  show_online_status TEXT NOT NULL DEFAULT 'everyone'
    CHECK (show_online_status IN ('everyone', 'friends', 'nobody')),
  allow_voice_activity_indicator BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_privacy_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read user_privacy_settings" ON user_privacy_settings;
CREATE POLICY "Anyone can read user_privacy_settings" ON user_privacy_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can insert user_privacy_settings" ON user_privacy_settings;
CREATE POLICY "Anyone can insert user_privacy_settings" ON user_privacy_settings FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Anyone can update user_privacy_settings" ON user_privacy_settings;
CREATE POLICY "Anyone can update user_privacy_settings" ON user_privacy_settings FOR UPDATE USING (true);

-- Profile the requester associated the friendship with
ALTER TABLE friend_requests ADD COLUMN IF NOT EXISTS requester_profile TEXT DEFAULT 'personal';
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'friend_requests_requester_profile_check'
  ) THEN
    ALTER TABLE friend_requests ADD CONSTRAINT friend_requests_requester_profile_check
      CHECK (requester_profile IS NULL OR requester_profile IN ('personal', 'work'));
  END IF;
END $$;

-- Per-user settings for each friendship (which profile + what the friend can see)
CREATE TABLE IF NOT EXISTS friend_profile_settings (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friendship_profile TEXT NOT NULL DEFAULT 'personal'
    CHECK (friendship_profile IN ('personal', 'work')),
  visible_profiles TEXT NOT NULL DEFAULT 'personal'
    CHECK (visible_profiles IN ('personal', 'work', 'both')),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, friend_id),
  CHECK (user_id != friend_id)
);

ALTER TABLE friend_profile_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read friend_profile_settings" ON friend_profile_settings;
CREATE POLICY "Anyone can read friend_profile_settings" ON friend_profile_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can insert friend_profile_settings" ON friend_profile_settings;
CREATE POLICY "Anyone can insert friend_profile_settings" ON friend_profile_settings FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Anyone can update friend_profile_settings" ON friend_profile_settings;
CREATE POLICY "Anyone can update friend_profile_settings" ON friend_profile_settings FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Anyone can delete friend_profile_settings" ON friend_profile_settings;
CREATE POLICY "Anyone can delete friend_profile_settings" ON friend_profile_settings FOR DELETE USING (true);
