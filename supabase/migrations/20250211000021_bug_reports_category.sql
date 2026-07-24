-- Support tickets reuse bug_reports with a category column (bug | support).
ALTER TABLE bug_reports
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'bug';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bug_reports_category_check'
  ) THEN
    ALTER TABLE bug_reports
      ADD CONSTRAINT bug_reports_category_check
      CHECK (category IN ('bug', 'support'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bug_reports_category ON bug_reports(category);
