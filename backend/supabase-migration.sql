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
CREATE POLICY "Anyone can read servers" ON servers FOR SELECT USING (true);
CREATE POLICY "Anyone can read channels" ON channels FOR SELECT USING (true);
CREATE POLICY "Anyone can read messages" ON messages FOR SELECT USING (true);
CREATE POLICY "Anyone can read users" ON users FOR SELECT USING (true);
CREATE POLICY "Anyone can insert messages" ON messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can insert users" ON users FOR INSERT WITH CHECK (true);
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
