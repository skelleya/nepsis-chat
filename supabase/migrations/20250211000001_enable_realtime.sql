-- Enable Supabase Realtime for messages and message_reactions
-- Run with: supabase db push (or apply via Supabase Dashboard SQL Editor)
-- Or: Supabase Dashboard > Database > Publications > supabase_realtime > add tables

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'message_reactions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE message_reactions;
  END IF;
END $$;
