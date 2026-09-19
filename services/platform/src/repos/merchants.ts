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
    .prepare(
      "SELECT id, email, password_hash, settlement_address, display_name, logo_content_type FROM merchants WHERE email = ?",
    )
    .bind(email)
    .first<MerchantRow>();
}

export async function findMerchantById(db: D1Database, id: string): Promise<MerchantRow | null> {
  return db
    .prepare(
      "SELECT id, email, password_hash, settlement_address, display_name, logo_content_type FROM merchants WHERE id = ?",
    )
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

export async function updateMerchantBranding(
  db: D1Database,
  merchantId: string,
  branding: { displayName: string | null; logoContentType: string | null },
  now: number,
): Promise<void> {
  await db
    .prepare("UPDATE merchants SET display_name = ?, logo_content_type = ?, updated_at = ? WHERE id = ?")
    .bind(branding.displayName, branding.logoContentType, now, merchantId)
    .run();
}

export async function upsertMerchantLogo(
  db: D1Database,
  merchantId: string,
  contentType: string,
  bytes: Uint8Array,
): Promise<void> {
  await db
    .prepare(
      "INSERT INTO merchant_logos (merchant_id, content_type, bytes) VALUES (?, ?, ?) ON CONFLICT(merchant_id) DO UPDATE SET content_type = excluded.content_type, bytes = excluded.bytes",
    )
    .bind(merchantId, contentType, bytes)
    .run();
}

export async function findMerchantLogo(
  db: D1Database,
  merchantId: string,
): Promise<{ content_type: string; bytes: ArrayBuffer } | null> {
  const row = await db
    .prepare("SELECT content_type, bytes FROM merchant_logos WHERE merchant_id = ?")
    .bind(merchantId)
    .first<{ content_type: string; bytes: ArrayBuffer }>();
  return row;
}
