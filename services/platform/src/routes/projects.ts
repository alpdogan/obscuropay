import { badRequest, newId } from "@obscurus/core";
import { Hono } from "hono";
import { requireMerchant } from "../auth.ts";
import { nowSeconds } from "../clock.ts";
import { readJson } from "../http/json.ts";
import { insertProject, listProjects } from "../repos/projects.ts";

export const projectRoutes = new Hono<{ Bindings: Env; Variables: { merchantId: string } }>();

projectRoutes.use("*", requireMerchant);

projectRoutes.get("/", async (c) => {
  const projects = await listProjects(c.env.DB, c.get("merchantId"));
  return c.json({
    projects: projects.map((project) => ({
      id: project.id,
      name: project.name,
      created_at: project.created_at,
      updated_at: project.updated_at,
    })),
  });
});

projectRoutes.post("/", async (c) => {
  const body = await readJson<{ name?: string }>(c.req.raw);
  const name = body.name?.trim() ?? "";
  if (name.length < 1 || name.length > 80) {
    throw badRequest("invalid_name", "Project name must be between 1 and 80 characters");
  }
  const id = newId("project");
  const now = nowSeconds();
  await insertProject(c.env.DB, { id, merchantId: c.get("merchantId"), name, now });
  return c.json({ project: { id, name, created_at: now, updated_at: now } }, 201);
});
