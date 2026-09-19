ALTER TABLE payments ADD COLUMN project_id TEXT;
ALTER TABLE payments ADD COLUMN expires_at INTEGER;
ALTER TABLE payments ADD COLUMN mock_ready INTEGER NOT NULL DEFAULT 0;

CREATE TABLE entitlements (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL REFERENCES merchants (id),
  endpoint_id TEXT NOT NULL REFERENCES endpoints (id),
  invocation_id TEXT NOT NULL UNIQUE REFERENCES invocations (id),
  payment_id TEXT NOT NULL UNIQUE REFERENCES payments (id),
  pricing_type TEXT NOT NULL DEFAULT 'PER_REQUEST',
  status TEXT NOT NULL,
  claimed_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX entitlements_merchant_id_idx ON entitlements (merchant_id);
CREATE INDEX payments_invocation_id_idx ON payments (invocation_id);
