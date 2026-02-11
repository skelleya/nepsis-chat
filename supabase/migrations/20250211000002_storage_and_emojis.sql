-- Storage bucket for attachments (images, videos, files)
-- Create attachments bucket - run via Supabase Dashboard or API if not exists
-- Note: Storage buckets are typically created via Dashboard > Storage > New bucket
-- This migration documents the required bucket: "attachments" (public)

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
DROP POLICY IF EXISTS "Server owner can insert server_emojis" ON server_emojis;
CREATE POLICY "Server owner can insert server_emojis" ON server_emojis FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Server owner can delete server_emojis" ON server_emojis;
CREATE POLICY "Server owner can delete server_emojis" ON server_emojis FOR DELETE USING (true);

-- Enable Realtime for server_emojis
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'server_emojis') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE server_emojis;
  END IF;
END $$;
