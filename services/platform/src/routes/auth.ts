import {
  assertEmail,
  assertPassword,
  conflict,
  hashPassword,
  newId,
  unauthorized,
  verifyPassword,
} from "@obscurus/core";
import { Hono } from "hono";
import { nowSeconds } from "../clock.ts";
import { randomToken, sha256Hex } from "../crypto.ts";
import { MAX_AGE, clearSessionCookie, readSessionToken, sessionCookie } from "../http/cookies.ts";
import { readJson } from "../http/json.ts";
import { findMerchantByEmail, findMerchantById, insertMerchant } from "../repos/merchants.ts";
import { deleteSession, findSessionMerchantId, insertSession } from "../repos/sessions.ts";
import { isProduction } from "../runtime.ts";

type AuthBody = { email?: string; password?: string };

export const authRoutes = new Hono<{ Bindings: Env; Variables: { merchantId: string } }>();

authRoutes.post("/register", async (c) => {
  const body = await readJson<AuthBody>(c.req.raw);
  const email = assertEmail(body.email ?? "");
  assertPassword(body.password ?? "");
  const existing = await findMerchantByEmail(c.env.DB, email);
  if (existing) {
    throw conflict("email_taken", "An account with this email already exists");
  }
  const id = newId("merchant");
  const now = nowSeconds();
  await insertMerchant(c.env.DB, {
    id,
    email,
    passwordHash: await hashPassword(body.password ?? ""),
    now,
  });
  return issueSession(c, id, email);
});

authRoutes.post("/login", async (c) => {
  const body = await readJson<AuthBody>(c.req.raw);
  const email = assertEmail(body.email ?? "");
  assertPassword(body.password ?? "");
  if (!(await allowLogin(c.env.RATE_LIMITS, email))) {
    throw unauthorized("Too many login attempts");
  }
  const merchant = await findMerchantByEmail(c.env.DB, email);
  if (!merchant || !(await verifyPassword(body.password ?? "", merchant.password_hash))) {
    throw unauthorized("Invalid email or password");
  }
  return issueSession(c, merchant.id, merchant.email);
});

authRoutes.post("/logout", async (c) => {
  const token = readSessionToken(c.req.header("cookie"));
  if (token) {
    await deleteSession(c.env.DB, await sha256Hex(token));
  }
  return c.json(
    { ok: true },
    200,
    { "Set-Cookie": clearSessionCookie(isProduction(c.env)) },
  );
});

authRoutes.get("/me", async (c) => {
  const token = readSessionToken(c.req.header("cookie"));
  if (!token) {
    throw unauthorized();
  }
  const merchantId = await findSessionMerchantId(c.env.DB, await sha256Hex(token), nowSeconds());
  if (!merchantId) {
    throw unauthorized();
  }
  const merchant = await findMerchantById(c.env.DB, merchantId);
  if (!merchant) {
    throw unauthorized();
  }
  return c.json({ merchant: { id: merchant.id, email: merchant.email } });
});

async function issueSession(
  c: { env: Env; json: (data: unknown, status: 201, headers: Record<string, string>) => Response },
  merchantId: string,
  email: string,
) {
  const token = randomToken();
  const now = nowSeconds();
  await insertSession(c.env.DB, {
    tokenHash: await sha256Hex(token),
    merchantId,
    expiresAt: now + MAX_AGE,
    now,
  });
  return c.json(
    { merchant: { id: merchantId, email } },
    201,
    { "Set-Cookie": sessionCookie(token, isProduction(c.env)) },
  );
}

async function allowLogin(kv: KVNamespace, email: string): Promise<boolean> {
  const key = `login:${email}`;
  const current = Number((await kv.get(key)) ?? "0");
  if (current >= 10) {
    return false;
  }
  await kv.put(key, String(current + 1), { expirationTtl: 15 * 60 });
  return true;
}
