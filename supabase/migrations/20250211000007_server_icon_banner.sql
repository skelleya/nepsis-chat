-- Server icon and banner: allow servers to have custom profile picture and banner
ALTER TABLE servers ADD COLUMN IF NOT EXISTS banner_url TEXT;
