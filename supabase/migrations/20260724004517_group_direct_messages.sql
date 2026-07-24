-- Additive group-DM metadata. Existing two-person conversations remain unchanged.
ALTER TABLE public.dm_conversations
  ADD COLUMN IF NOT EXISTS is_group BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS created_by TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.dm_participants
  ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.dm_conversations
  DROP CONSTRAINT IF EXISTS dm_conversations_name_length;
ALTER TABLE public.dm_conversations
  ADD CONSTRAINT dm_conversations_name_length
  CHECK (name IS NULL OR char_length(name) BETWEEN 1 AND 80);

CREATE INDEX IF NOT EXISTS idx_dm_participants_user_id
  ON public.dm_participants(user_id, conversation_id);

CREATE INDEX IF NOT EXISTS idx_dm_conversations_group_updated
  ON public.dm_conversations(is_group, updated_at DESC)
  WHERE is_group = true;

-- Protect against pre-existing manually-created multi-participant rows.
UPDATE public.dm_conversations conversation
SET is_group = true,
    updated_at = now()
WHERE (
  SELECT count(*)
  FROM public.dm_participants participant
  WHERE participant.conversation_id = conversation.id
) > 2;
