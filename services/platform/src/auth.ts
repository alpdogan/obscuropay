import { unauthorized } from "@obscurus/core";
import type { MiddlewareHandler } from "hono";
import { nowSeconds } from "./clock.ts";
import { sha256Hex } from "./crypto.ts";
import { readSessionToken } from "./http/cookies.ts";
import { findSessionMerchantId } from "./repos/sessions.ts";

export const requireMerchant: MiddlewareHandler<{
  Bindings: Env;
  Variables: { merchantId: string };
}> = async (c, next) => {
  const token = readSessionToken(c.req.header("cookie"));
  if (!token) {
    throw unauthorized();
  }
  const merchantId = await findSessionMerchantId(c.env.DB, await sha256Hex(token), nowSeconds());
  if (!merchantId) {
    throw unauthorized();
  }
  c.set("merchantId", merchantId);
  await next();
};
