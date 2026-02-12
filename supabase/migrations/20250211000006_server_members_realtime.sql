-- Enable Supabase Realtime for server_members table
-- This allows instant updates when users join/leave servers
-- Run in Supabase Dashboard > SQL Editor

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'server_members') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE server_members;
  END IF;
END $$;
