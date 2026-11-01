-- Add theme customization to merchants table
-- Stores theme config as JSON: { colors: { accent, background, ... }, typography, borders }

ALTER TABLE merchants ADD COLUMN theme_config TEXT;
