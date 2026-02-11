-- Server invites (Discord-style invite links)
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

-- Audit log for server actions
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
