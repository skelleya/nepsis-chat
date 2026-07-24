-- Server-scoped soundboard: sounds belong to a server and are visible to all members.

ALTER TABLE soundboard_sounds
  ADD COLUMN IF NOT EXISTS server_id TEXT REFERENCES servers(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_soundboard_sounds_server_id
  ON soundboard_sounds(server_id);

COMMENT ON COLUMN soundboard_sounds.server_id IS
  'When set, the sound is listed for every member of this server. NULL = legacy personal-only sound.';
