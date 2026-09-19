import { badRequest } from "../errors.ts";

export type SsrfOptions = {
  allowHttp: boolean;
};

export type SsrfDecision = { ok: true; url: URL } | { ok: false; reason: string };

const BLOCKED_HOSTS = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.internal",
  "kubernetes.default",
  "kubernetes.default.svc",
]);

const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]);

export function assertHttpMethod(method: string): string {
  const normalized = method.toUpperCase();
  if (!ALLOWED_METHODS.has(normalized)) {
    throw badRequest("unsupported_method", "HTTP method is not allowed");
  }
  return normalized;
}

export function inspectUrl(raw: string, opts: SsrfOptions): SsrfDecision {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "invalid_url" };
  }

  if (url.username !== "" || url.password !== "") {
    return { ok: false, reason: "url_credentials" };
  }

  if (url.protocol === "http:") {
    if (!opts.allowHttp) {
      return { ok: false, reason: "http_not_allowed" };
    }
  } else if (url.protocol !== "https:") {
    return { ok: false, reason: "unsupported_scheme" };
  }

  const host = normalizeHostname(url.hostname);
  if (
    BLOCKED_HOSTS.has(host) ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".arpa")
  ) {
    return { ok: false, reason: "blocked_hostname" };
  }

  if (looksLikeIp(host) && isBlockedIp(host)) {
    return { ok: false, reason: "blocked_ip" };
  }

  return { ok: true, url };
}

export function looksLikeIp(host: string): boolean {
  return isIpv4(host) !== null || host.includes(":");
}

export function isBlockedIp(ip: string): boolean {
  const v4 = isIpv4(ip);
  if (v4) {
    return isBlockedIpv4(v4);
  }
  return isBlockedIpv6(ip);
}

function normalizeHostname(hostname: string): string {
  return hostname.replace(/^\[|\]$/g, "").toLowerCase();
}

function isIpv4(host: string): [number, number, number, number] | null {
  if (/^\d+$/.test(host)) {
    const n = Number(host);
    if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) {
      return null;
    }
    return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  }
  const parts = host.split(".");
  if (parts.length !== 4) {
    return null;
  }
  const nums: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) {
      return null;
    }
    const n = Number(part);
    if (n > 255) {
      return null;
    }
    nums.push(n);
  }
  return [nums[0]!, nums[1]!, nums[2]!, nums[3]!];
}

function isBlockedIpv4(octets: [number, number, number, number]): boolean {
  const [a, b] = octets;
  if (a === 0 || a === 127 || a === 10) {
    return true;
  }
  if (a === 169 && b === 254) {
    return true;
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  if (a === 192 && b === 168) {
    return true;
  }
  if (a === 100 && b >= 64 && b <= 127) {
    return true;
  }
  return false;
}

function isBlockedIpv6(ip: string): boolean {
  const mapped = ipv4Mapped(ip);
  if (mapped) {
    return isBlockedIpv4(mapped);
  }
  const compressed = expandIpv6(ip);
  if (!compressed) {
    return true;
  }
  if (compressed === "0000:0000:0000:0000:0000:0000:0000:0001") {
    return true;
  }
  if (compressed === "0000:0000:0000:0000:0000:0000:0000:0000") {
    return true;
  }
  const first = Number.parseInt(compressed.slice(0, 4), 16);
  if ((first & 0xfe00) === 0xfc00) {
    return true;
  }
  if ((first & 0xffc0) === 0xfe80) {
    return true;
  }
  return false;
}

function ipv4Mapped(ip: string): [number, number, number, number] | null {
  const lower = ip.toLowerCase();
  const prefix = "::ffff:";
  if (!lower.startsWith(prefix) && !lower.startsWith("0:0:0:0:0:ffff:")) {
    return null;
  }
  const tail = lower.includes(".")
    ? lower.slice(lower.lastIndexOf(":") + 1)
    : null;
  if (tail && isIpv4(tail)) {
    return isIpv4(tail);
  }
  return null;
}

function expandIpv6(ip: string): string | null {
  if (ip.includes(".")) {
    return null;
  }
  const [head, tail] = ip.split("::");
  const headParts = head ? head.split(":") : [];
  const tailParts = tail ? tail.split(":") : [];
  if (ip.includes("::")) {
    const missing = 8 - headParts.filter(Boolean).length - tailParts.filter(Boolean).length;
    if (missing < 0) {
      return null;
    }
    const filled = [
      ...headParts.filter(Boolean),
      ...Array.from({ length: missing }, () => "0"),
      ...tailParts.filter(Boolean),
    ];
    if (filled.length !== 8) {
      return null;
    }
    return filled.map((p) => p.padStart(4, "0").toLowerCase()).join(":");
  }
  const parts = ip.split(":");
  if (parts.length !== 8) {
    return null;
  }
  return parts.map((p) => p.padStart(4, "0").toLowerCase()).join(":");
}
