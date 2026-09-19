import type { EndpointRow } from "./types.ts";

export async function insertEndpoint(db: D1Database, row: EndpointRow): Promise<void> {
  await db
    .prepare(
      `INSERT INTO endpoints (
        id, merchant_id, project_id, name, slug, method, url, headers_json, body_template,
        input_schema_json, pricing_type, price_amount, price_asset, response_mode, response_select,
        response_template, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      row.id,
      row.merchant_id,
      row.project_id,
      row.name,
      row.slug,
      row.method,
      row.url,
      row.headers_json,
      row.body_template,
      row.input_schema_json,
      row.pricing_type,
      row.price_amount,
      row.price_asset,
      row.response_mode,
      row.response_select,
      row.response_template,
      row.created_at,
      row.updated_at,
    )
    .run();
}

export async function findEndpoint(db: D1Database, merchantId: string, endpointId: string): Promise<EndpointRow | null> {
  return db
    .prepare("SELECT * FROM endpoints WHERE id = ? AND merchant_id = ?")
    .bind(endpointId, merchantId)
    .first<EndpointRow>();
}

export async function findEndpointById(db: D1Database, endpointId: string): Promise<EndpointRow | null> {
  return db.prepare("SELECT * FROM endpoints WHERE id = ?").bind(endpointId).first<EndpointRow>();
}

export async function listEndpoints(db: D1Database, merchantId: string): Promise<EndpointRow[]> {
  const result = await db
    .prepare("SELECT * FROM endpoints WHERE merchant_id = ? ORDER BY created_at DESC LIMIT 50")
    .bind(merchantId)
    .all<EndpointRow>();
  return result.results;
}

export async function updateEndpoint(db: D1Database, row: EndpointRow): Promise<void> {
  await db
    .prepare(
      `UPDATE endpoints SET
        name = ?, slug = ?, method = ?, url = ?, headers_json = ?, body_template = ?,
        input_schema_json = ?, price_amount = ?, price_asset = ?, response_mode = ?,
        response_select = ?, response_template = ?, updated_at = ?
      WHERE id = ? AND merchant_id = ?`,
    )
    .bind(
      row.name,
      row.slug,
      row.method,
      row.url,
      row.headers_json,
      row.body_template,
      row.input_schema_json,
      row.price_amount,
      row.price_asset,
      row.response_mode,
      row.response_select,
      row.response_template,
      row.updated_at,
      row.id,
      row.merchant_id,
    )
    .run();
}
