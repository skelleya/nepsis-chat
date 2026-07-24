-- Follow-up for projects where the base group-DM migration was already applied.
CREATE INDEX IF NOT EXISTS idx_dm_conversations_created_by
  ON public.dm_conversations(created_by)
  WHERE created_by IS NOT NULL;
