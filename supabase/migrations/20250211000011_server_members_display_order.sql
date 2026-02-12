-- Add display_order to server_members for user-specific server list ordering
-- NULL = use default (name). 0 = first, 1 = second, etc.
ALTER TABLE server_members ADD COLUMN IF NOT EXISTS display_order INTEGER;

-- Allow users to update their own server_members row (for display_order)
DROP POLICY IF EXISTS "Anyone can update server_members" ON server_members;
CREATE POLICY "Anyone can update server_members" ON server_members FOR UPDATE USING (true) WITH CHECK (true);
