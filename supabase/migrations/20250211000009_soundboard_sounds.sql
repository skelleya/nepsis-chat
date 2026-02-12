-- User soundboard sounds: custom audio clips up to 10 seconds for voice channels
-- Stored in attachments bucket under soundboard/{userId}/

CREATE TABLE IF NOT EXISTS soundboard_sounds (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  duration_seconds NUMERIC(4,2) NOT NULL CHECK (duration_seconds > 0 AND duration_seconds <= 10),
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_soundboard_sounds_user_id ON soundboard_sounds(user_id);

ALTER TABLE soundboard_sounds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own soundboard sounds" ON soundboard_sounds;
CREATE POLICY "Users can read own soundboard sounds" ON soundboard_sounds FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert own soundboard sounds" ON soundboard_sounds;
CREATE POLICY "Users can insert own soundboard sounds" ON soundboard_sounds FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete own soundboard sounds" ON soundboard_sounds;
CREATE POLICY "Users can delete own soundboard sounds" ON soundboard_sounds FOR DELETE USING (true);

-- Backend validates ownership via userId in request; service role bypasses RLS
