-- Enable Realtime for user_presence so clients see online / in-voice status immediately.
-- Backend writes with service_role; clients only need SELECT for Realtime delivery.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'user_presence'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE user_presence;
  END IF;
END $$;

DROP POLICY IF EXISTS "Public read user presence" ON public.user_presence;
CREATE POLICY "Public read user presence"
ON public.user_presence
FOR SELECT
TO public
USING (true);
