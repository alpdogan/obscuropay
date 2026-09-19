import { notFound } from "@obscurus/core";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { findMerchantLogo } from "../repos/merchants.ts";

export const logoRoutes = new Hono<{ Bindings: Env }>();

logoRoutes.use("*", cors());

logoRoutes.get("/:merchantId", async (c) => {
  const logo = await findMerchantLogo(c.env.DB, c.req.param("merchantId"));
  if (!logo) {
    throw notFound("logo");
  }
  return new Response(logo.bytes, {
    headers: {
      "content-type": logo.content_type,
      "cache-control": "public, max-age=300",
    },
  });
});
