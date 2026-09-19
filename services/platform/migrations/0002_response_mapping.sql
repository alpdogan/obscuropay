ALTER TABLE endpoints ADD COLUMN response_mode TEXT NOT NULL DEFAULT 'passthrough';
ALTER TABLE endpoints ADD COLUMN response_select TEXT;
ALTER TABLE endpoints ADD COLUMN response_template TEXT;
