-- DM Realtime requires SELECT policies so anon clients receive postgres_changes.
-- Tables had RLS enabled without policies, so INSERT events never reached the UI.
ALTER TABLE dm_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE dm_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE dm_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read dm_conversations" ON dm_conversations;
CREATE POLICY "Anyone can read dm_conversations" ON dm_conversations FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can insert dm_conversations" ON dm_conversations;
CREATE POLICY "Anyone can insert dm_conversations" ON dm_conversations FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can read dm_participants" ON dm_participants;
CREATE POLICY "Anyone can read dm_participants" ON dm_participants FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can insert dm_participants" ON dm_participants;
CREATE POLICY "Anyone can insert dm_participants" ON dm_participants FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can read dm_messages" ON dm_messages;
CREATE POLICY "Anyone can read dm_messages" ON dm_messages FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can insert dm_messages" ON dm_messages;
CREATE POLICY "Anyone can insert dm_messages" ON dm_messages FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Anyone can update dm_messages" ON dm_messages;
CREATE POLICY "Anyone can update dm_messages" ON dm_messages FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Anyone can delete dm_messages" ON dm_messages;
CREATE POLICY "Anyone can delete dm_messages" ON dm_messages FOR DELETE USING (true);
