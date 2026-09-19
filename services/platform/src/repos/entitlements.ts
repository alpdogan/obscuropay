import type { EntitlementRow } from "./types.ts";

export async function insertEntitlement(db: D1Database, row: EntitlementRow): Promise<void> {
  await db
    .prepare(
      `INSERT INTO entitlements (
        id, merchant_id, endpoint_id, invocation_id, payment_id, pricing_type, status, claimed_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      row.id,
      row.merchant_id,
      row.endpoint_id,
      row.invocation_id,
      row.payment_id,
      row.pricing_type,
      row.status,
      row.claimed_at,
      row.created_at,
    )
    .run();
}

export async function updateEntitlement(db: D1Database, row: EntitlementRow): Promise<void> {
  await db
    .prepare("UPDATE entitlements SET status = ?, claimed_at = ? WHERE id = ?")
    .bind(row.status, row.claimed_at, row.id)
    .run();
}

export async function findEntitlementByPayment(db: D1Database, paymentId: string): Promise<EntitlementRow | null> {
  return db.prepare("SELECT * FROM entitlements WHERE payment_id = ?").bind(paymentId).first<EntitlementRow>();
}
