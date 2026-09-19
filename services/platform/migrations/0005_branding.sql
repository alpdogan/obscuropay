ALTER TABLE merchants ADD COLUMN display_name TEXT;
ALTER TABLE merchants ADD COLUMN logo_content_type TEXT;

CREATE TABLE merchant_logos (
  merchant_id TEXT PRIMARY KEY REFERENCES merchants (id),
  content_type TEXT NOT NULL,
  bytes BLOB NOT NULL
);
