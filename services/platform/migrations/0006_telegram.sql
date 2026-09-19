CREATE TABLE telegram_integrations (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants (id),
  project_id TEXT NOT NULL REFERENCES projects (id),
  endpoint_id TEXT NOT NULL REFERENCES endpoints (id),
  command TEXT NOT NULL,
  input_field TEXT,
  secret_id TEXT NOT NULL REFERENCES secrets (id),
  webhook_secret TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (merchant_id, command)
);

CREATE INDEX telegram_integrations_endpoint_idx ON telegram_integrations (merchant_id, endpoint_id);

CREATE TABLE telegram_sessions (
  invocation_id TEXT PRIMARY KEY REFERENCES invocations (id),
  merchant_id TEXT NOT NULL,
  integration_id TEXT NOT NULL REFERENCES telegram_integrations (id),
  chat_id TEXT NOT NULL,
  delivered_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX telegram_sessions_integration_idx ON telegram_sessions (integration_id, created_at);
