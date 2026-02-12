-- ============================================================
-- Run all pending migrations (3, 4, 5) in Supabase SQL Editor
-- Copy-paste this entire file into Dashboard > SQL Editor > Run
-- ============================================================

-- Ensure user_presence table exists (from main migration)
CREATE TABLE IF NOT EXISTS user_presence (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'in-voice')),
  voice_channel_id TEXT REFERENCES channels(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read user_presence" ON user_presence;
CREATE POLICY "Anyone can read user_presence" ON user_presence FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can insert user_presence" ON user_presence;
CREATE POLICY "Anyone can insert user_presence" ON user_presence FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Anyone can update user_presence" ON user_presence;
CREATE POLICY "Anyone can update user_presence" ON user_presence FOR UPDATE USING (true);

-- ============================================================
-- Migration 2: Friend requests
-- ============================================================
CREATE TABLE IF NOT EXISTS friend_requests (
  requester_id TEXT NOT NULL REFERENCES users(id),
  addressee_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (requester_id, addressee_id),
  CHECK (requester_id != addressee_id)
);
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read friend_requests" ON friend_requests;
CREATE POLICY "Anyone can read friend_requests" ON friend_requests FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can insert friend_requests" ON friend_requests;
CREATE POLICY "Anyone can insert friend_requests" ON friend_requests FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Anyone can update friend_requests" ON friend_requests;
CREATE POLICY "Anyone can update friend_requests" ON friend_requests FOR UPDATE USING (true);

-- ============================================================
-- Migration 3: User profiles & extended presence status
-- ============================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS banner_url TEXT;

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

-- ============================================================
-- Migration 4: Server invites & audit log
-- ============================================================
CREATE TABLE IF NOT EXISTS server_invites (
  code TEXT PRIMARY KEY,
  server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL REFERENCES users(id),
  expires_at TIMESTAMPTZ,
  max_uses INTEGER,
  use_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_server_invites_server ON server_invites(server_id);
ALTER TABLE server_invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read server_invites" ON server_invites;
CREATE POLICY "Anyone can read server_invites" ON server_invites FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can insert server_invites" ON server_invites;
CREATE POLICY "Anyone can insert server_invites" ON server_invites FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Anyone can update server_invites" ON server_invites;
CREATE POLICY "Anyone can update server_invites" ON server_invites FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Anyone can delete server_invites" ON server_invites;
CREATE POLICY "Anyone can delete server_invites" ON server_invites FOR DELETE USING (true);

CREATE TABLE IF NOT EXISTS server_audit_log (
  id TEXT PRIMARY KEY,
  server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_server ON server_audit_log(server_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON server_audit_log(created_at DESC);
ALTER TABLE server_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read server_audit_log" ON server_audit_log;
CREATE POLICY "Anyone can read server_audit_log" ON server_audit_log FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can insert server_audit_log" ON server_audit_log;
CREATE POLICY "Anyone can insert server_audit_log" ON server_audit_log FOR INSERT WITH CHECK (true);

-- ============================================================
-- Migration 5: Community servers
-- ============================================================
ALTER TABLE servers ADD COLUMN IF NOT EXISTS is_community BOOLEAN DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_servers_community ON servers(is_community) WHERE is_community = true;

-- ============================================================
-- Migration 5b: DM tables (if not created by main supabase-migration.sql)
-- ============================================================
CREATE TABLE IF NOT EXISTS dm_conversations (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS dm_participants (
  conversation_id TEXT NOT NULL REFERENCES dm_conversations(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  PRIMARY KEY (conversation_id, user_id)
);
CREATE TABLE IF NOT EXISTS dm_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES dm_conversations(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE dm_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE dm_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE dm_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read dm_conversations" ON dm_conversations;
CREATE POLICY "Anyone can read dm_conversations" ON dm_conversations FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can insert dm_conversations" ON dm_conversations;
CREATE POLICY "Anyone can insert dm_conversations" ON dm_conversations FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Anyone can read dm_participants" ON dm_participants;
CREATE POLICY "Anyone can read dm_participants" ON dm_participants FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can insert dm_participants" ON dm_participants;
CREATE POLICY "Anyone can insert dm_participants" ON dm_participants FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Anyone can read dm_messages" ON dm_messages;
CREATE POLICY "Anyone can read dm_messages" ON dm_messages FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can insert dm_messages" ON dm_messages;
CREATE POLICY "Anyone can insert dm_messages" ON dm_messages FOR INSERT WITH CHECK (true);

-- ============================================================
-- Migration 6: dm_messages Realtime
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'dm_messages') AND
     NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'dm_messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE dm_messages;
  END IF;
END $$;

-- ============================================================
-- Migration 7: server_members Realtime (instant join/leave)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'server_members') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE server_members;
  END IF;
END $$;

-- ============================================================
-- Migration 8: Server icon and banner
-- ============================================================
ALTER TABLE servers ADD COLUMN IF NOT EXISTS banner_url TEXT;
