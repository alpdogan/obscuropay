import { AesGcmSecretBox, badRequest, newId, notFound, secretHint } from "@obscurus/core";
import { Hono } from "hono";
import { requireMerchant } from "../auth.ts";
import { nowSeconds } from "../clock.ts";
import { readJson } from "../http/json.ts";
import { findProject } from "../repos/projects.ts";
import { insertSecret, listSecrets } from "../repos/secrets.ts";

export const secretRoutes = new Hono<{ Bindings: Env; Variables: { merchantId: string } }>();

secretRoutes.use("*", requireMerchant);

secretRoutes.get("/", async (c) => {
  const projectId = c.req.query("project_id");
  if (!projectId) {
    throw badRequest("invalid_project", "project_id is required");
  }
  const project = await findProject(c.env.DB, c.get("merchantId"), projectId);
  if (!project) {
    throw notFound("project");
  }
  const secrets = await listSecrets(c.env.DB, c.get("merchantId"), projectId);
  return c.json({
    secrets: secrets.map((secret) => ({
      id: secret.id,
      project_id: secret.project_id,
      name: secret.name,
      hint: secret.hint,
      created_at: secret.created_at,
    })),
  });
});

secretRoutes.post("/", async (c) => {
  const body = await readJson<{ project_id?: string; name?: string; value?: string }>(c.req.raw);
  const project = await findProject(c.env.DB, c.get("merchantId"), body.project_id ?? "");
  if (!project) {
    throw notFound("project");
  }
  const name = body.name?.trim() ?? "";
  const value = body.value ?? "";
  if (name.length < 1 || name.length > 64) {
    throw badRequest("invalid_name", "Secret name must be between 1 and 64 characters");
  }
  if (value.length < 1 || value.length > 4096) {
    throw badRequest("invalid_secret", "Secret value must be between 1 and 4096 characters");
  }
  const box = AesGcmSecretBox.fromBase64(c.env.SECRET_KEK);
  const id = newId("secret");
  const now = nowSeconds();
  await insertSecret(c.env.DB, {
    id,
    merchantId: c.get("merchantId"),
    projectId: project.id,
    name,
    ciphertext: await box.encrypt(value),
    hint: secretHint(value),
    now,
  });
  return c.json({ secret: { id, project_id: project.id, name, hint: secretHint(value), created_at: now } }, 201);
});
