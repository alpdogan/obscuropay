import { Hono } from "hono";

export const healthRoutes = new Hono<{ Bindings: Env; Variables: { requestId?: string } }>();

healthRoutes.get("/health", (c) => {
  return c.json({ status: "ok", request_id: c.get("requestId") ?? null });
});

healthRoutes.get("/ready", async (c) => {
  try {
    await c.env.DB.prepare("SELECT 1 AS ok").first();
    return c.json({ status: "ready", request_id: c.get("requestId") ?? null });
  } catch {
    return c.json({ status: "not_ready", request_id: c.get("requestId") ?? null }, 503);
  }
});
