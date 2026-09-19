import type { MerchantRow } from "./types.ts";

export async function insertMerchant(
  db: D1Database,
  row: { id: string; email: string; passwordHash: string; now: number },
): Promise<void> {
  await db
    .prepare(
      "INSERT INTO merchants (id, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(row.id, row.email, row.passwordHash, row.now, row.now)
    .run();
}

export async function findMerchantByEmail(db: D1Database, email: string): Promise<MerchantRow | null> {
  return db
    .prepare("SELECT id, email, password_hash, settlement_address FROM merchants WHERE email = ?")
    .bind(email)
    .first<MerchantRow>();
}

export async function findMerchantById(db: D1Database, id: string): Promise<MerchantRow | null> {
  return db
    .prepare("SELECT id, email, password_hash, settlement_address FROM merchants WHERE id = ?")
    .bind(id)
    .first<MerchantRow>();
}

export async function updateMerchantSettlement(
  db: D1Database,
  merchantId: string,
  settlementAddress: string | null,
  now: number,
): Promise<void> {
  await db
    .prepare("UPDATE merchants SET settlement_address = ?, updated_at = ? WHERE id = ?")
    .bind(settlementAddress, now, merchantId)
    .run();
}
