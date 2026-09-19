import type { WebhookDeliveryRow, WebhookEndpointRow } from "./types.ts";

export async function insertWebhookEndpoint(db: D1Database, row: WebhookEndpointRow): Promise<void> {
  await db
    .prepare(
      `INSERT INTO webhook_endpoints (
        id, merchant_id, project_id, url, secret_id, events_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      row.id,
      row.merchant_id,
      row.project_id,
      row.url,
      row.secret_id,
      row.events_json,
      row.created_at,
      row.updated_at,
    )
    .run();
}

export async function listWebhookEndpoints(db: D1Database, merchantId: string): Promise<WebhookEndpointRow[]> {
  const result = await db
    .prepare("SELECT * FROM webhook_endpoints WHERE merchant_id = ? ORDER BY created_at DESC")
    .bind(merchantId)
    .all<WebhookEndpointRow>();
  return result.results;
}

export async function listWebhookEndpointsByProject(
  db: D1Database,
  merchantId: string,
  projectId: string,
): Promise<WebhookEndpointRow[]> {
  const result = await db
    .prepare("SELECT * FROM webhook_endpoints WHERE merchant_id = ? AND project_id = ?")
    .bind(merchantId, projectId)
    .all<WebhookEndpointRow>();
  return result.results;
}

export async function findWebhookEndpoint(
  db: D1Database,
  merchantId: string,
  id: string,
): Promise<WebhookEndpointRow | null> {
  return db
    .prepare("SELECT * FROM webhook_endpoints WHERE id = ? AND merchant_id = ?")
    .bind(id, merchantId)
    .first<WebhookEndpointRow>();
}

export async function insertWebhookDelivery(db: D1Database, row: WebhookDeliveryRow): Promise<void> {
  await db
    .prepare(
      `INSERT INTO webhook_deliveries (
        id, merchant_id, webhook_id, event, payload_json, status, attempt_count,
        last_http_status, last_error, next_attempt_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      row.id,
      row.merchant_id,
      row.webhook_id,
      row.event,
      row.payload_json,
      row.status,
      row.attempt_count,
      row.last_http_status,
      row.last_error,
      row.next_attempt_at,
      row.created_at,
      row.updated_at,
    )
    .run();
}

export async function updateWebhookDelivery(db: D1Database, row: WebhookDeliveryRow): Promise<void> {
  await db
    .prepare(
      `UPDATE webhook_deliveries SET
        status = ?, attempt_count = ?, last_http_status = ?, last_error = ?, next_attempt_at = ?, updated_at = ?
      WHERE id = ? AND merchant_id = ?`,
    )
    .bind(
      row.status,
      row.attempt_count,
      row.last_http_status,
      row.last_error,
      row.next_attempt_at,
      row.updated_at,
      row.id,
      row.merchant_id,
    )
    .run();
}

export async function listWebhookDeliveries(
  db: D1Database,
  merchantId: string,
  webhookId: string,
): Promise<WebhookDeliveryRow[]> {
  const result = await db
    .prepare(
      "SELECT * FROM webhook_deliveries WHERE merchant_id = ? AND webhook_id = ? ORDER BY created_at DESC LIMIT 50",
    )
    .bind(merchantId, webhookId)
    .all<WebhookDeliveryRow>();
  return result.results;
}

export async function findWebhookDelivery(
  db: D1Database,
  merchantId: string,
  id: string,
): Promise<WebhookDeliveryRow | null> {
  return db
    .prepare("SELECT * FROM webhook_deliveries WHERE id = ? AND merchant_id = ?")
    .bind(id, merchantId)
    .first<WebhookDeliveryRow>();
}

export async function latestWebhookDelivery(
  db: D1Database,
  merchantId: string,
  webhookId: string,
): Promise<WebhookDeliveryRow | null> {
  return db
    .prepare(
      "SELECT * FROM webhook_deliveries WHERE merchant_id = ? AND webhook_id = ? ORDER BY created_at DESC LIMIT 1",
    )
    .bind(merchantId, webhookId)
    .first<WebhookDeliveryRow>();
}
