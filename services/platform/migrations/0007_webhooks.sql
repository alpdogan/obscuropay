CREATE TABLE webhook_endpoints (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants (id),
  project_id TEXT NOT NULL REFERENCES projects (id),
  url TEXT NOT NULL,
  secret_id TEXT NOT NULL REFERENCES secrets (id),
  events_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX webhook_endpoints_merchant_idx ON webhook_endpoints (merchant_id, project_id);

CREATE TABLE webhook_deliveries (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  webhook_id TEXT NOT NULL REFERENCES webhook_endpoints (id),
  event TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_http_status INTEGER,
  last_error TEXT,
  next_attempt_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX webhook_deliveries_webhook_idx ON webhook_deliveries (webhook_id, created_at);
