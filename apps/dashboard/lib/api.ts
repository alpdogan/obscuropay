import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { platformOrigin } from "./config.ts";

const SESSION = "obscurus_session";

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const jar = await cookies();
  const token = jar.get(SESSION)?.value;
  const headers = new Headers(init.headers);
  if (token) {
    headers.set("cookie", `${SESSION}=${token}`);
  }
  if (init.body && !headers.has("content-type") && !(init.body instanceof FormData) && !(init.body instanceof ArrayBuffer)) {
    headers.set("content-type", "application/json");
  }
  const response = await fetch(`${platformOrigin()}${path}`, { ...init, headers, cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (response.status === 401) {
    redirect("/login");
  }
  if (!response.ok) {
    const message = (body as { error?: { message?: string } }).error?.message ?? `Request failed (${response.status})`;
    throw new Error(message);
  }
  return body as T;
}

export async function setSessionFromResponse(response: Response): Promise<void> {
  const header = response.headers.get("set-cookie") ?? "";
  const match = header.match(new RegExp(`${SESSION}=([^;]+)`));
  if (!match?.[1]) {
    return;
  }
  const jar = await cookies();
  jar.set(SESSION, match[1], { httpOnly: true, path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 7 });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION);
}

export async function hasSession(): Promise<boolean> {
  const jar = await cookies();
  return Boolean(jar.get(SESSION)?.value);
}
