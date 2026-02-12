-- Bug reports: users can submit bug reports to developers
CREATE TABLE IF NOT EXISTS bug_reports (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  username TEXT,
  email TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  url TEXT,
  user_agent TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'wontfix')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON bug_reports(status);
CREATE INDEX IF NOT EXISTS idx_bug_reports_created ON bug_reports(created_at DESC);

ALTER TABLE bug_reports ENABLE ROW LEVEL SECURITY;
-- Allow inserts (backend uses service_role; this policy allows anon if needed)
DROP POLICY IF EXISTS "Allow insert bug_reports" ON bug_reports;
CREATE POLICY "Allow insert bug_reports" ON bug_reports FOR INSERT WITH CHECK (true);
-- No SELECT policy: only service_role (backend) can read; anon cannot list reports
