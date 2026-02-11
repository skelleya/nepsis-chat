-- Nepsis Chat — Supabase migration
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)

-- Users table (links to Supabase Auth for email users, standalone for guests)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  email TEXT,
  avatar_url TEXT,
  auth_id UUID UNIQUE,  -- links to auth.users.id for email accounts (NULL for guests)
  is_guest BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Servers
CREATE TABLE IF NOT EXISTS servers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon_url TEXT,
  owner_id TEXT NOT NULL REFERENCES users(id)
);

-- Channels
CREATE TABLE IF NOT EXISTS channels (
  id TEXT PRIMARY KEY,
  server_id TEXT NOT NULL REFERENCES servers(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('text', 'voice')),
  "order" INTEGER DEFAULT 0
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL REFERENCES channels(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- DM conversations
CREATE TABLE IF NOT EXISTS dm_conversations (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- DM participants
CREATE TABLE IF NOT EXISTS dm_participants (
  conversation_id TEXT NOT NULL REFERENCES dm_conversations(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  PRIMARY KEY (conversation_id, user_id)
);

-- DM messages
CREATE TABLE IF NOT EXISTS dm_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES dm_conversations(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE dm_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE dm_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE dm_messages ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (backend uses service role key)
-- For now, allow all operations via service role (policies use service_role bypass)
-- Public (anon) read access for servers and channels
DROP POLICY IF EXISTS "Anyone can read servers" ON servers;
CREATE POLICY "Anyone can read servers" ON servers FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can read channels" ON channels;
CREATE POLICY "Anyone can read channels" ON channels FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can read messages" ON messages;
CREATE POLICY "Anyone can read messages" ON messages FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can read users" ON users;
CREATE POLICY "Anyone can read users" ON users FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can insert messages" ON messages;
CREATE POLICY "Anyone can insert messages" ON messages FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Anyone can insert users" ON users;
CREATE POLICY "Anyone can insert users" ON users FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Anyone can update users" ON users;
CREATE POLICY "Anyone can update users" ON users FOR UPDATE USING (true);

-- Seed data
INSERT INTO users (id, username, is_guest) VALUES
  ('u1', 'System', false),
  ('u2', 'Alice', true),
  ('u3', 'Bob', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO servers (id, name, owner_id) VALUES
  ('1', 'Nepsis Chat', 'u1'),
  ('2', 'Gaming Hub', 'u1')
ON CONFLICT (id) DO NOTHING;

INSERT INTO channels (id, server_id, name, type, "order") VALUES
  ('c1', '1', 'general', 'text', 0),
  ('c2', '1', 'voice-chat', 'voice', 1),
  ('c3', '1', 'announcements', 'text', 2),
  ('c4', '2', 'lobby', 'voice', 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO messages (id, channel_id, user_id, content) VALUES
  ('m1', 'c1', 'u1', 'Welcome to Nepsis Chat!'),
  ('m2', 'c1', 'u2', 'Hi everyone!')
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- Migration v2: Categories, server members
-- =============================================

-- Categories for organizing channels (like Discord)
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  "order" INTEGER DEFAULT 0
);

-- Add category_id to channels (nullable for uncategorized)
ALTER TABLE channels ADD COLUMN IF NOT EXISTS category_id TEXT REFERENCES categories(id) ON DELETE SET NULL;

-- Server members (tracks which users joined which servers)
CREATE TABLE IF NOT EXISTS server_members (
  server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (server_id, user_id)
);

-- RLS for new tables
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE server_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read categories" ON categories;
CREATE POLICY "Anyone can read categories" ON categories FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can insert categories" ON categories;
CREATE POLICY "Anyone can insert categories" ON categories FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Anyone can update categories" ON categories;
CREATE POLICY "Anyone can update categories" ON categories FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Anyone can delete categories" ON categories;
CREATE POLICY "Anyone can delete categories" ON categories FOR DELETE USING (true);
DROP POLICY IF EXISTS "Anyone can read server_members" ON server_members;
CREATE POLICY "Anyone can read server_members" ON server_members FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can insert server_members" ON server_members;
CREATE POLICY "Anyone can insert server_members" ON server_members FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Anyone can delete server_members" ON server_members;
CREATE POLICY "Anyone can delete server_members" ON server_members FOR DELETE USING (true);
-- Allow server/channel creation & deletion
DROP POLICY IF EXISTS "Anyone can insert servers" ON servers;
CREATE POLICY "Anyone can insert servers" ON servers FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Anyone can update servers" ON servers;
CREATE POLICY "Anyone can update servers" ON servers FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Anyone can delete servers" ON servers;
CREATE POLICY "Anyone can delete servers" ON servers FOR DELETE USING (true);
DROP POLICY IF EXISTS "Anyone can insert channels" ON channels;
CREATE POLICY "Anyone can insert channels" ON channels FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Anyone can update channels" ON channels;
CREATE POLICY "Anyone can update channels" ON channels FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Anyone can delete channels" ON channels;
CREATE POLICY "Anyone can delete channels" ON channels FOR DELETE USING (true);

-- Seed categories for existing servers
INSERT INTO categories (id, server_id, name, "order") VALUES
  ('cat1', '1', 'Text Channels', 0),
  ('cat2', '1', 'Voice Channels', 1),
  ('cat3', '2', 'General', 0)
ON CONFLICT (id) DO NOTHING;

-- Update existing channels with category references
UPDATE channels SET category_id = 'cat1' WHERE id IN ('c1', 'c3') AND category_id IS NULL;
UPDATE channels SET category_id = 'cat2' WHERE id = 'c2' AND category_id IS NULL;
UPDATE channels SET category_id = 'cat3' WHERE id = 'c4' AND category_id IS NULL;

-- =============================================
-- Migration v3: Message edits, replies, reactions, attachments, presence
-- =============================================

-- Message edits & replies
ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id TEXT REFERENCES messages(id) ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;
DROP POLICY IF EXISTS "Anyone can update messages" ON messages;
CREATE POLICY "Anyone can update messages" ON messages FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Anyone can delete messages" ON messages;
CREATE POLICY "Anyone can delete messages" ON messages FOR DELETE USING (true);

-- Message reactions (emoji, user)
CREATE TABLE IF NOT EXISTS message_reactions (
  message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji)
);
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read message_reactions" ON message_reactions;
CREATE POLICY "Anyone can read message_reactions" ON message_reactions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can insert message_reactions" ON message_reactions;
CREATE POLICY "Anyone can insert message_reactions" ON message_reactions FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Anyone can delete message_reactions" ON message_reactions;
CREATE POLICY "Anyone can delete message_reactions" ON message_reactions FOR DELETE USING (true);

-- User presence (activity status: online, offline, in-voice)
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

-- Seed server_members for existing servers (owner + members)
INSERT INTO server_members (server_id, user_id, role) VALUES
  ('1', 'u1', 'owner'),
  ('1', 'u2', 'member'),
  ('1', 'u3', 'member'),
  ('2', 'u1', 'owner')
ON CONFLICT (server_id, user_id) DO NOTHING;

-- Storage bucket for attachments (run in Supabase Dashboard > Storage if needed):
-- Create bucket "attachments" with public access for message images/files/videos/GIFs.

-- =============================================
-- Migration v4: Realtime, server emojis
-- =============================================

-- Enable Supabase Realtime for messages and message_reactions
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'message_reactions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE message_reactions;
  END IF;
END $$;

-- Server emojis: custom emojis uploaded by server owners (email users only)
CREATE TABLE IF NOT EXISTS server_emojis (
  id TEXT PRIMARY KEY,
  server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  uploaded_by TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(server_id, name)
);
ALTER TABLE server_emojis ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read server_emojis" ON server_emojis;
CREATE POLICY "Anyone can read server_emojis" ON server_emojis FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can insert server_emojis" ON server_emojis;
CREATE POLICY "Anyone can insert server_emojis" ON server_emojis FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Anyone can delete server_emojis" ON server_emojis;
CREATE POLICY "Anyone can delete server_emojis" ON server_emojis FOR DELETE USING (true);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'server_emojis') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE server_emojis;
  END IF;
END $$;
