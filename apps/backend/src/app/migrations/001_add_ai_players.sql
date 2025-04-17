-- Add AI player support
ALTER TABLE players
ADD COLUMN IF NOT EXISTS is_ai BOOLEAN DEFAULT FALSE;

-- Update existing records to have is_ai set to false
UPDATE players SET is_ai = FALSE WHERE is_ai IS NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_players_is_ai ON players(is_ai);
