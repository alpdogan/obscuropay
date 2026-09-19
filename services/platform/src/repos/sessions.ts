export async function insertSession(
  db: D1Database,
  row: { tokenHash: string; merchantId: string; expiresAt: number; now: number },
): Promise<void> {
  await db
    .prepare("INSERT INTO sessions (token_hash, merchant_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .bind(row.tokenHash, row.merchantId, row.expiresAt, row.now)
    .run();
}

export async function findSessionMerchantId(
  db: D1Database,
  tokenHash: string,
  now: number,
): Promise<string | null> {
  const row = await db
    .prepare("SELECT merchant_id FROM sessions WHERE token_hash = ? AND expires_at > ?")
    .bind(tokenHash, now)
    .first<{ merchant_id: string }>();
  return row?.merchant_id ?? null;
}

export async function deleteSession(db: D1Database, tokenHash: string): Promise<void> {
  await db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
}
