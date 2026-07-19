-- Server bans: prevent kicked users from rejoining after an admin ban
CREATE TABLE IF NOT EXISTS server_bans (
  server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  banned_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (server_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_server_bans_user ON server_bans(user_id);
CREATE INDEX IF NOT EXISTS idx_server_bans_server ON server_bans(server_id);

ALTER TABLE server_bans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read server_bans" ON server_bans;
CREATE POLICY "Anyone can read server_bans" ON server_bans FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can insert server_bans" ON server_bans;
CREATE POLICY "Anyone can insert server_bans" ON server_bans FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Anyone can delete server_bans" ON server_bans;
CREATE POLICY "Anyone can delete server_bans" ON server_bans FOR DELETE USING (true);
