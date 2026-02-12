-- Friend requests (for Add Friend feature)
CREATE TABLE IF NOT EXISTS friend_requests (
  requester_id TEXT NOT NULL REFERENCES users(id),
  addressee_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (requester_id, addressee_id),
  CHECK (requester_id != addressee_id)
);

ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read friend_requests" ON friend_requests;
CREATE POLICY "Anyone can read friend_requests" ON friend_requests FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can insert friend_requests" ON friend_requests;
CREATE POLICY "Anyone can insert friend_requests" ON friend_requests FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Anyone can update friend_requests" ON friend_requests;
CREATE POLICY "Anyone can update friend_requests" ON friend_requests FOR UPDATE USING (true);
