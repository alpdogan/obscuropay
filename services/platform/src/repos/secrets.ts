import type { SecretRow } from "./types.ts";

export async function insertSecret(
  db: D1Database,
  row: {
    id: string;
    merchantId: string;
    projectId: string;
    name: string;
    ciphertext: string;
    hint: string;
    now: number;
  },
): Promise<void> {
  await db
    .prepare(
      "INSERT INTO secrets (id, merchant_id, project_id, name, ciphertext, hint, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(row.id, row.merchantId, row.projectId, row.name, row.ciphertext, row.hint, row.now)
    .run();
}

export async function listSecrets(db: D1Database, merchantId: string, projectId: string): Promise<SecretRow[]> {
  const result = await db
    .prepare(
      "SELECT id, merchant_id, project_id, name, ciphertext, hint, created_at FROM secrets WHERE merchant_id = ? AND project_id = ? ORDER BY created_at DESC",
    )
    .bind(merchantId, projectId)
    .all<SecretRow>();
  return result.results;
}

export async function findSecret(db: D1Database, merchantId: string, secretId: string): Promise<SecretRow | null> {
  return db
    .prepare(
      "SELECT id, merchant_id, project_id, name, ciphertext, hint, created_at FROM secrets WHERE id = ? AND merchant_id = ?",
    )
    .bind(secretId, merchantId)
    .first<SecretRow>();
}
