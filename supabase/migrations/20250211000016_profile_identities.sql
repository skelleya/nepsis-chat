-- Dual profile identities: bios, discoverability, per-server presentation profile

-- Public profile fields (login username stays private on users.username)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT '';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS discoverable BOOLEAN DEFAULT true;

-- Work profiles default to not discoverable when column is first added for existing rows
UPDATE user_profiles SET discoverable = false WHERE profile_type = 'work' AND discoverable IS DISTINCT FROM true;
UPDATE user_profiles SET discoverable = true WHERE profile_type = 'personal' AND discoverable IS NULL;

-- Which of the addressee's profiles a friend request targets
ALTER TABLE friend_requests ADD COLUMN IF NOT EXISTS addressee_profile TEXT DEFAULT 'personal';
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'friend_requests_addressee_profile_check'
  ) THEN
    ALTER TABLE friend_requests ADD CONSTRAINT friend_requests_addressee_profile_check
      CHECK (addressee_profile IS NULL OR addressee_profile IN ('personal', 'work'));
  END IF;
END $$;

-- Which profile this member uses when appearing in a given server
ALTER TABLE server_members ADD COLUMN IF NOT EXISTS profile_type TEXT DEFAULT 'personal';
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'server_members_profile_type_check'
  ) THEN
    ALTER TABLE server_members ADD CONSTRAINT server_members_profile_type_check
      CHECK (profile_type IS NULL OR profile_type IN ('personal', 'work'));
  END IF;
END $$;

-- Helpful index for profile search by display name
CREATE INDEX IF NOT EXISTS user_profiles_discoverable_display_name_idx
  ON user_profiles (discoverable, lower(display_name));
