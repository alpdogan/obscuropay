CREATE TABLE merchants (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants (id),
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX sessions_merchant_id_idx ON sessions (merchant_id);
CREATE INDEX sessions_expires_at_idx ON sessions (expires_at);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants (id),
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX projects_merchant_id_idx ON projects (merchant_id);

CREATE TABLE secrets (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants (id),
  project_id TEXT NOT NULL REFERENCES projects (id),
  name TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  hint TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (project_id, name)
);

CREATE INDEX secrets_merchant_id_idx ON secrets (merchant_id);

CREATE TABLE endpoints (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants (id),
  project_id TEXT NOT NULL REFERENCES projects (id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  method TEXT NOT NULL,
  url TEXT NOT NULL,
  headers_json TEXT NOT NULL,
  body_template TEXT,
  input_schema_json TEXT NOT NULL,
  pricing_type TEXT NOT NULL DEFAULT 'PER_REQUEST',
  price_amount TEXT NOT NULL,
  price_asset TEXT NOT NULL DEFAULT 'USDC',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (project_id, slug)
);

CREATE INDEX endpoints_merchant_id_idx ON endpoints (merchant_id);

CREATE TABLE invocations (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants (id),
  project_id TEXT NOT NULL REFERENCES projects (id),
  endpoint_id TEXT NOT NULL REFERENCES endpoints (id),
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  input_json TEXT NOT NULL,
  output_preview TEXT,
  error_class TEXT,
  http_status INTEGER,
  created_at INTEGER NOT NULL,
  completed_at INTEGER
);

CREATE INDEX invocations_merchant_endpoint_idx ON invocations (merchant_id, endpoint_id, created_at);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants (id),
  endpoint_id TEXT,
  invocation_id TEXT,
  amount TEXT NOT NULL,
  asset TEXT NOT NULL,
  state TEXT NOT NULL,
  payment_ref TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX payments_merchant_id_idx ON payments (merchant_id);
