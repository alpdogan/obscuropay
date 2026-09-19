import { assertDisplayName, inspectLogo, unauthorized } from "@obscurus/core";
import { Hono } from "hono";
import { requireMerchant } from "../auth.ts";
import { nowSeconds } from "../clock.ts";
import { readJson } from "../http/json.ts";
import { findMerchantById, updateMerchantBranding, upsertMerchantLogo } from "../repos/merchants.ts";

export const brandingRoutes = new Hono<{ Bindings: Env; Variables: { merchantId: string } }>();

brandingRoutes.use("*", requireMerchant);

function presentBranding(merchant: {
  id: string;
  display_name: string | null;
  logo_content_type: string | null;
}) {
  return {
    display_name: merchant.display_name,
    logo_content_type: merchant.logo_content_type,
    logo_url: merchant.logo_content_type ? `/v1/logos/${merchant.id}` : null,
    disclosures_required: true,
  };
}

brandingRoutes.get("/", async (c) => {
  const merchant = await findMerchantById(c.env.DB, c.get("merchantId"));
  if (!merchant) {
    throw unauthorized();
  }
  return c.json({ branding: presentBranding(merchant) });
});

brandingRoutes.patch("/", async (c) => {
  const merchant = await findMerchantById(c.env.DB, c.get("merchantId"));
  if (!merchant) {
    throw unauthorized();
  }
  const body = await readJson<{ display_name?: string }>(c.req.raw);
  const displayName = body.display_name !== undefined ? assertDisplayName(body.display_name) : merchant.display_name;
  await updateMerchantBranding(
    c.env.DB,
    merchant.id,
    {
      displayName,
      logoContentType: merchant.logo_content_type,
    },
    nowSeconds(),
  );
  const updated = await findMerchantById(c.env.DB, merchant.id);
  return c.json({ branding: presentBranding(updated ?? merchant) });
});

brandingRoutes.put("/logo", async (c) => {
  const merchant = await findMerchantById(c.env.DB, c.get("merchantId"));
  if (!merchant) {
    throw unauthorized();
  }
  const bytes = new Uint8Array(await c.req.arrayBuffer());
  const type = inspectLogo(bytes, c.req.header("content-type") ?? "");
  await upsertMerchantLogo(c.env.DB, merchant.id, type, bytes);
  await updateMerchantBranding(
    c.env.DB,
    merchant.id,
    {
      displayName: merchant.display_name,
      logoContentType: type,
    },
    nowSeconds(),
  );
  return c.json({ branding: presentBranding({ ...merchant, logo_content_type: type }) });
});
