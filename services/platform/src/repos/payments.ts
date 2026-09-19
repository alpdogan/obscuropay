import type { PaymentRow } from "./types.ts";

export async function insertPayment(db: D1Database, row: PaymentRow): Promise<void> {
  await db
    .prepare(
      `INSERT INTO payments (
        id, merchant_id, project_id, endpoint_id, invocation_id, amount, asset, state,
        payment_ref, provider, expires_at, mock_ready, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      row.id,
      row.merchant_id,
      row.project_id,
      row.endpoint_id,
      row.invocation_id,
      row.amount,
      row.asset,
      row.state,
      row.payment_ref,
      row.provider,
      row.expires_at,
      row.mock_ready,
      row.created_at,
      row.updated_at,
    )
    .run();
}

export async function updatePayment(db: D1Database, row: PaymentRow): Promise<void> {
  await db
    .prepare(
      `UPDATE payments SET
        state = ?, mock_ready = ?, expires_at = ?, updated_at = ?
      WHERE id = ?`,
    )
    .bind(row.state, row.mock_ready, row.expires_at, row.updated_at, row.id)
    .run();
}

export async function findPaymentById(db: D1Database, paymentId: string): Promise<PaymentRow | null> {
  return db.prepare("SELECT * FROM payments WHERE id = ?").bind(paymentId).first<PaymentRow>();
}

export async function findPaymentForMerchant(
  db: D1Database,
  merchantId: string,
  paymentId: string,
): Promise<PaymentRow | null> {
  return db
    .prepare("SELECT * FROM payments WHERE id = ? AND merchant_id = ?")
    .bind(paymentId, merchantId)
    .first<PaymentRow>();
}

export async function listPayments(db: D1Database, merchantId: string): Promise<PaymentRow[]> {
  const result = await db
    .prepare("SELECT * FROM payments WHERE merchant_id = ? ORDER BY created_at DESC LIMIT 50")
    .bind(merchantId)
    .all<PaymentRow>();
  return result.results;
}
