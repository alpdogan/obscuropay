import { inspectUrl, isBlockedIp, looksLikeIp } from "@obscurus/core";

const MAX_BYTES = 65_536;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 10_000;

export type ExecutedResponse = {
  status: number;
  contentType: string;
  body: string;
};

export async function executeMerchantRequest(input: {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string | null;
  allowHttp: boolean;
}): Promise<ExecutedResponse> {
  let current = input.url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const inspected = inspectUrl(current, { allowHttp: input.allowHttp });
    if (!inspected.ok) {
      throw new ExecutorError(inspected.reason);
    }
    await assertResolvedPublic(inspected.url.hostname);

    const response = await fetch(inspected.url.toString(), {
      method: hop === 0 ? input.method : "GET",
      headers: hop === 0 ? input.headers : undefined,
      body: hop === 0 && input.body !== null && input.method !== "GET" && input.method !== "HEAD" ? input.body : undefined,
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || hop === MAX_REDIRECTS) {
        throw new ExecutorError("redirect_denied");
      }
      current = new URL(location, inspected.url).toString();
      continue;
    }

    return {
      status: response.status,
      contentType: response.headers.get("content-type") ?? "application/octet-stream",
      body: await readLimited(response),
    };
  }
  throw new ExecutorError("redirect_denied");
}

export class ExecutorError extends Error {
  readonly reason: string;
  constructor(reason: string) {
    super(reason);
    this.name = "ExecutorError";
    this.reason = reason;
  }
}

async function assertResolvedPublic(hostname: string): Promise<void> {
  if (looksLikeIp(hostname)) {
    if (isBlockedIp(hostname)) {
      throw new ExecutorError("blocked_ip");
    }
    return;
  }
  const records = await resolveDns(hostname);
  if (records.length === 0) {
    throw new ExecutorError("dns_lookup_failed");
  }
  if (records.some((ip) => isBlockedIp(ip))) {
    throw new ExecutorError("blocked_ip");
  }
}

async function resolveDns(hostname: string): Promise<string[]> {
  const ips = new Set<string>();
  for (const type of ["A", "AAAA"]) {
    const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=${type}`;
    const response = await fetch(url, {
      headers: { Accept: "application/dns-json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      continue;
    }
    const data = (await response.json()) as { Answer?: { type: number; data: string }[] };
    for (const answer of data.Answer ?? []) {
      if (answer.type === 1 || answer.type === 28) {
        ips.add(answer.data.replace(/\.$/, ""));
      }
    }
  }
  return [...ips];
}

async function readLimited(response: Response): Promise<string> {
  if (!response.body) {
    return "";
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    if (!value) {
      continue;
    }
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new ExecutorError("response_too_large");
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}
