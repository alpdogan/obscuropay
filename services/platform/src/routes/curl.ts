import { badRequest, parseCurl, presentParsedCurl } from "@obscurus/core";
import { Hono } from "hono";
import { requireMerchant } from "../auth.ts";
import { readJson } from "../http/json.ts";

export const curlRoutes = new Hono<{ Bindings: Env; Variables: { merchantId: string } }>();

curlRoutes.use("*", requireMerchant);

curlRoutes.post("/import", async (c) => {
  const body = await readJson<{ curl?: string }>(c.req.raw);
  if (typeof body.curl !== "string") {
    throw badRequest("invalid_curl", "curl is required");
  }
  const parsed = parseCurl(body.curl);
  return c.json({ import: presentParsedCurl(parsed) });
});
