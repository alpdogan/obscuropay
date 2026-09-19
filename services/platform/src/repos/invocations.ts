import type { InvocationRow } from "./types.ts";

export async function insertInvocation(db: D1Database, row: InvocationRow): Promise<void> {
  await db
    .prepare(
      `INSERT INTO invocations (
        id, merchant_id, project_id, endpoint_id, source, status, input_json,
        output_preview, error_class, http_status, created_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      row.id,
      row.merchant_id,
      row.project_id,
      row.endpoint_id,
      row.source,
      row.status,
      row.input_json,
      row.output_preview,
      row.error_class,
      row.http_status,
      row.created_at,
      row.completed_at,
    )
    .run();
}

export async function updateInvocation(db: D1Database, row: InvocationRow): Promise<void> {
  await db
    .prepare(
      `UPDATE invocations SET
        status = ?, output_preview = ?, error_class = ?, http_status = ?, completed_at = ?
      WHERE id = ? AND merchant_id = ?`,
    )
    .bind(
      row.status,
      row.output_preview,
      row.error_class,
      row.http_status,
      row.completed_at,
      row.id,
      row.merchant_id,
    )
    .run();
}

export async function listInvocations(
  db: D1Database,
  merchantId: string,
  endpointId?: string,
): Promise<InvocationRow[]> {
  if (endpointId) {
    const result = await db
      .prepare(
        "SELECT * FROM invocations WHERE merchant_id = ? AND endpoint_id = ? ORDER BY created_at DESC LIMIT 50",
      )
      .bind(merchantId, endpointId)
      .all<InvocationRow>();
    return result.results;
  }
  const result = await db
    .prepare("SELECT * FROM invocations WHERE merchant_id = ? ORDER BY created_at DESC LIMIT 50")
    .bind(merchantId)
    .all<InvocationRow>();
  return result.results;
}

export async function findInvocation(
  db: D1Database,
  merchantId: string,
  invocationId: string,
): Promise<InvocationRow | null> {
  return db
    .prepare("SELECT * FROM invocations WHERE id = ? AND merchant_id = ?")
    .bind(invocationId, merchantId)
    .first<InvocationRow>();
}

export async function findInvocationById(db: D1Database, invocationId: string): Promise<InvocationRow | null> {
  return db.prepare("SELECT * FROM invocations WHERE id = ?").bind(invocationId).first<InvocationRow>();
}
