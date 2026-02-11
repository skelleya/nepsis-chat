-- Community servers: discoverable, auto-joined for new users
-- Servers with is_community=true appear in the Community page (compass icon) and are auto-joined for new accounts.
ALTER TABLE servers ADD COLUMN IF NOT EXISTS is_community BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_servers_community ON servers(is_community) WHERE is_community = true;

-- To mark a server as community: UPDATE servers SET is_community = true WHERE id = 's-xxx';
