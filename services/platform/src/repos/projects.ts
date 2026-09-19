import type { ProjectRow } from "./types.ts";

export async function insertProject(
  db: D1Database,
  row: { id: string; merchantId: string; name: string; now: number },
): Promise<void> {
  await db
    .prepare("INSERT INTO projects (id, merchant_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
    .bind(row.id, row.merchantId, row.name, row.now, row.now)
    .run();
}

export async function listProjects(db: D1Database, merchantId: string): Promise<ProjectRow[]> {
  const result = await db
    .prepare(
      "SELECT id, merchant_id, name, created_at, updated_at FROM projects WHERE merchant_id = ? ORDER BY created_at DESC",
    )
    .bind(merchantId)
    .all<ProjectRow>();
  return result.results;
}

export async function findProject(
  db: D1Database,
  merchantId: string,
  projectId: string,
): Promise<ProjectRow | null> {
  return db
    .prepare("SELECT id, merchant_id, name, created_at, updated_at FROM projects WHERE id = ? AND merchant_id = ?")
    .bind(projectId, merchantId)
    .first<ProjectRow>();
}
