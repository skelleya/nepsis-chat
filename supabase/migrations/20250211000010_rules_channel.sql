-- Rules channel: server rules display, emoji-only reactions, optional channel lock until accepted
-- Only owner/admin can create and configure rules channel

-- Add 'rules' to channel type (drop and recreate constraint)
DO $$
DECLARE
  cname TEXT;
BEGIN
  SELECT conname INTO cname FROM pg_constraint
  WHERE conrelid = 'channels'::regclass AND contype = 'c'
  AND pg_get_constraintdef(oid) LIKE '%type%' LIMIT 1;
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE channels DROP CONSTRAINT %I', cname);
  END IF;
  ALTER TABLE channels ADD CONSTRAINT channels_type_check
    CHECK (type IN ('text', 'voice', 'rules'));
END $$;

-- Server rules settings
ALTER TABLE servers ADD COLUMN IF NOT EXISTS rules_channel_id TEXT REFERENCES channels(id) ON DELETE SET NULL;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS lock_channels_until_rules_accepted BOOLEAN DEFAULT false;
ALTER TABLE servers ADD COLUMN IF NOT EXISTS rules_accept_emoji TEXT DEFAULT '👍';

-- Rules acceptance tracking: when user reacts with accept emoji in rules channel
CREATE TABLE IF NOT EXISTS rules_acceptances (
  server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  accepted_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (server_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_rules_acceptances_server ON rules_acceptances(server_id);
ALTER TABLE rules_acceptances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read rules_acceptances" ON rules_acceptances;
CREATE POLICY "Anyone can read rules_acceptances" ON rules_acceptances FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can insert rules_acceptances" ON rules_acceptances;
CREATE POLICY "Anyone can insert rules_acceptances" ON rules_acceptances FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Anyone can delete rules_acceptances" ON rules_acceptances;
CREATE POLICY "Anyone can delete rules_acceptances" ON rules_acceptances FOR DELETE USING (true);
