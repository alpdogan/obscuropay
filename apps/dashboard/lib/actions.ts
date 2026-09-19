"use server";

import { redirect } from "next/navigation";
import { api, clearSession, setSessionFromResponse } from "./api.ts";
import { platformOrigin } from "./config.ts";

async function auth(path: "/v1/auth/login" | "/v1/auth/register", email: string, password: string) {
  const response = await fetch(`${platformOrigin()}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(body.error?.message ?? "Authentication failed");
  }
  await setSessionFromResponse(response);
  redirect("/overview");
}

export async function loginAction(formData: FormData) {
  await auth("/v1/auth/login", String(formData.get("email") ?? ""), String(formData.get("password") ?? ""));
}

export async function registerAction(formData: FormData) {
  await auth("/v1/auth/register", String(formData.get("email") ?? ""), String(formData.get("password") ?? ""));
}

export async function logoutAction() {
  try {
    await api("/v1/auth/logout", { method: "POST" });
  } finally {
    await clearSession();
  }
  redirect("/login");
}

export async function createProjectAction(formData: FormData) {
  await api("/v1/projects", { method: "POST", body: JSON.stringify({ name: String(formData.get("name") ?? "") }) });
  redirect("/endpoints");
}

export async function importCurlAction(formData: FormData) {
  await api("/v1/endpoints/from-curl", {
    method: "POST",
    body: JSON.stringify({
      project_id: String(formData.get("project_id") ?? ""),
      curl: String(formData.get("curl") ?? ""),
      name: String(formData.get("name") ?? "Imported endpoint"),
      customer_fields: String(formData.get("customer_fields") ?? "")
        .split(",")
        .map((field) => field.trim())
        .filter(Boolean),
      price_amount: String(formData.get("price_amount") ?? "0.50"),
    }),
  });
  redirect("/endpoints");
}

export async function saveSettlementAction(formData: FormData) {
  await api("/v1/auth/me", {
    method: "PATCH",
    body: JSON.stringify({ settlement_address: String(formData.get("settlement_address") ?? "") || null }),
  });
  redirect("/settings");
}

export async function createWebhookAction(formData: FormData) {
  await api("/v1/webhooks", {
    method: "POST",
    body: JSON.stringify({
      project_id: String(formData.get("project_id") ?? ""),
      url: String(formData.get("url") ?? ""),
    }),
  });
  redirect("/webhooks");
}

export async function retryWebhookAction(formData: FormData) {
  const id = String(formData.get("delivery_id") ?? "");
  await api(`/v1/webhooks/deliveries/${id}/retry`, { method: "POST" });
  redirect("/webhooks");
}

export async function connectTelegramAction(formData: FormData) {
  await api("/v1/integrations/telegram", {
    method: "POST",
    body: JSON.stringify({
      project_id: String(formData.get("project_id") ?? ""),
      endpoint_id: String(formData.get("endpoint_id") ?? ""),
      command: String(formData.get("command") ?? ""),
      input_field: String(formData.get("input_field") ?? "") || undefined,
      bot_token: String(formData.get("bot_token") ?? ""),
    }),
  });
  redirect("/integrations");
}

export async function saveBrandingAction(formData: FormData) {
  await api("/v1/branding", {
    method: "PATCH",
    body: JSON.stringify({ display_name: String(formData.get("display_name") ?? "") }),
  });
  redirect("/branding");
}
