import type { TelegramIntegrationRow, TelegramSessionRow } from "./types.ts";

export async function insertTelegramIntegration(db: D1Database, row: TelegramIntegrationRow): Promise<void> {
  await db
    .prepare(
      `INSERT INTO telegram_integrations (
        id, merchant_id, project_id, endpoint_id, command, input_field, secret_id, webhook_secret, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      row.id,
      row.merchant_id,
      row.project_id,
      row.endpoint_id,
      row.command,
      row.input_field,
      row.secret_id,
      row.webhook_secret,
      row.created_at,
      row.updated_at,
    )
    .run();
}

export async function updateTelegramIntegration(db: D1Database, row: TelegramIntegrationRow): Promise<void> {
  await db
    .prepare(
      `UPDATE telegram_integrations SET
        project_id = ?, endpoint_id = ?, input_field = ?, secret_id = ?, webhook_secret = ?, updated_at = ?
      WHERE id = ? AND merchant_id = ?`,
    )
    .bind(
      row.project_id,
      row.endpoint_id,
      row.input_field,
      row.secret_id,
      row.webhook_secret,
      row.updated_at,
      row.id,
      row.merchant_id,
    )
    .run();
}

export async function listTelegramIntegrations(db: D1Database, merchantId: string): Promise<TelegramIntegrationRow[]> {
  const result = await db
    .prepare("SELECT * FROM telegram_integrations WHERE merchant_id = ? ORDER BY created_at DESC")
    .bind(merchantId)
    .all<TelegramIntegrationRow>();
  return result.results;
}

export async function findTelegramIntegration(
  db: D1Database,
  merchantId: string,
  id: string,
): Promise<TelegramIntegrationRow | null> {
  return db
    .prepare("SELECT * FROM telegram_integrations WHERE id = ? AND merchant_id = ?")
    .bind(id, merchantId)
    .first<TelegramIntegrationRow>();
}

export async function findTelegramIntegrationById(
  db: D1Database,
  id: string,
): Promise<TelegramIntegrationRow | null> {
  return db.prepare("SELECT * FROM telegram_integrations WHERE id = ?").bind(id).first<TelegramIntegrationRow>();
}

export async function findTelegramByCommand(
  db: D1Database,
  merchantId: string,
  command: string,
): Promise<TelegramIntegrationRow | null> {
  return db
    .prepare("SELECT * FROM telegram_integrations WHERE merchant_id = ? AND command = ?")
    .bind(merchantId, command)
    .first<TelegramIntegrationRow>();
}

export async function insertTelegramSession(db: D1Database, row: TelegramSessionRow): Promise<void> {
  await db
    .prepare(
      `INSERT INTO telegram_sessions (
        invocation_id, merchant_id, integration_id, chat_id, delivered_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(row.invocation_id, row.merchant_id, row.integration_id, row.chat_id, row.delivered_at, row.created_at)
    .run();
}

export async function findTelegramSession(
  db: D1Database,
  invocationId: string,
): Promise<TelegramSessionRow | null> {
  return db.prepare("SELECT * FROM telegram_sessions WHERE invocation_id = ?").bind(invocationId).first<TelegramSessionRow>();
}

export async function markTelegramDelivered(db: D1Database, invocationId: string, now: number): Promise<void> {
  await db
    .prepare("UPDATE telegram_sessions SET delivered_at = ? WHERE invocation_id = ? AND delivered_at IS NULL")
    .bind(now, invocationId)
    .run();
}
