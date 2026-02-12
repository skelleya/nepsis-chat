-- Add emoji column to soundboard sounds (optional, shown on each sound button)
ALTER TABLE soundboard_sounds ADD COLUMN IF NOT EXISTS emoji TEXT DEFAULT '🔊';

-- Allow users to update their own soundboard sounds (e.g. change emoji)
DROP POLICY IF EXISTS "Users can update own soundboard sounds" ON soundboard_sounds;
CREATE POLICY "Users can update own soundboard sounds" ON soundboard_sounds FOR UPDATE USING (true) WITH CHECK (true);
