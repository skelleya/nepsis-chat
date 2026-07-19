-- DM message reactions + reply_to_id + realtime

ALTER TABLE dm_messages
  ADD COLUMN IF NOT EXISTS reply_to_id TEXT REFERENCES dm_messages(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS dm_message_reactions (
  message_id TEXT NOT NULL REFERENCES dm_messages(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_dm_message_reactions_message ON dm_message_reactions(message_id);

ALTER TABLE dm_message_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read dm_message_reactions" ON dm_message_reactions;
CREATE POLICY "Anyone can read dm_message_reactions" ON dm_message_reactions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert dm_message_reactions" ON dm_message_reactions;
CREATE POLICY "Anyone can insert dm_message_reactions" ON dm_message_reactions FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can delete dm_message_reactions" ON dm_message_reactions;
CREATE POLICY "Anyone can delete dm_message_reactions" ON dm_message_reactions FOR DELETE USING (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'dm_message_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE dm_message_reactions;
  END IF;
END $$;
