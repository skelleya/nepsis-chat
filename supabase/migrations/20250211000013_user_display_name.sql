-- Add display_name to users: shown in UI instead of username when set
-- Username stays fixed for login; display_name is the friendly name others see
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT;
