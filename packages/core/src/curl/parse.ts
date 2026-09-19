import { badRequest } from "../errors.ts";
import { secretHint } from "../secrets/box.ts";
import { assertHttpMethod } from "../http/ssrf.ts";
import type { FieldType, InputField, InputSchema } from "../endpoint/schema.ts";

export type ParsedHeader = {
  name: string;
  value: string;
  masked: string;
  secret: boolean;
  secretReason?: string;
};

export type ParsedCurl = {
  method: string;
  url: string;
  headers: ParsedHeader[];
  body: string | null;
  ignoredFlags: string[];
  warnings: string[];
};

export type SuggestedInput = {
  name: string;
  type: FieldType;
  required: boolean;
  sample: string | number | boolean;
};

const SECRET_HEADER_NAMES = new Set([
  "authorization",
  "proxy-authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "api-key",
  "x-auth-token",
  "x-access-token",
  "x-csrf-token",
  "x-session-token",
]);

const IGNORED_FLAGS = new Set([
  "-o",
  "--output",
  "-O",
  "--remote-name",
  "-v",
  "--verbose",
  "-s",
  "--silent",
  "-S",
  "--show-error",
  "-k",
  "--insecure",
  "-L",
  "--location",
  "--compressed",
  "-A",
  "--user-agent",
  "-e",
  "--referer",
]);

const VALUE_FLAGS_ONE = new Set(["-o", "--output", "-O", "--remote-name", "-A", "--user-agent", "-e", "--referer"]);

export function parseCurl(source: string): ParsedCurl {
  if (typeof source !== "string" || source.trim() === "") {
    throw badRequest("invalid_curl", "cURL text is required");
  }
  const { tokens, warnings } = tokenize(source);
  if (tokens.length === 0) {
    throw badRequest("invalid_curl", "No cURL command found");
  }

  let index = 0;
  if (tokens[0]?.toLowerCase() === "curl") {
    index = 1;
  }

  let method: string | null = null;
  let url: string | null = null;
  const headers: ParsedHeader[] = [];
  let body: string | null = null;
  const ignoredFlags: string[] = [];
  let dataImpliesPost = false;

  while (index < tokens.length) {
    const token = tokens[index] ?? "";
    if (token.startsWith("-")) {
      const flag = token;
      const next = tokens[index + 1];
      if (flag === "-X" || flag === "--request") {
        if (!next) {
          throw badRequest("invalid_curl", "Missing method after -X");
        }
        method = next.toUpperCase();
        index += 2;
        continue;
      }
      if (flag === "-H" || flag === "--header") {
        if (!next) {
          throw badRequest("invalid_curl", "Missing header after -H");
        }
        headers.push(parseHeaderLine(next));
        index += 2;
        continue;
      }
      if (flag === "-d" || flag === "--data" || flag === "--data-raw" || flag === "--data-binary" || flag === "--data-ascii") {
        if (!next) {
          throw badRequest("invalid_curl", "Missing body after -d");
        }
        body = next;
        dataImpliesPost = true;
        index += 2;
        continue;
      }
      if (flag === "--url") {
        if (!next) {
          throw badRequest("invalid_curl", "Missing URL after --url");
        }
        url = next;
        index += 2;
        continue;
      }
      if (flag === "-u" || flag === "--user") {
        if (!next) {
          throw badRequest("invalid_curl", "Missing value after -u");
        }
        headers.push(parseHeaderLine(`Authorization: Basic ${next}`));
        warnings.push("basic_auth_detected");
        index += 2;
        continue;
      }
      ignoredFlags.push(flag);
      if (VALUE_FLAGS_ONE.has(flag) || IGNORED_FLAGS.has(flag)) {
        index += flag.startsWith("--") && !VALUE_FLAGS_ONE.has(flag) ? 1 : VALUE_FLAGS_ONE.has(flag) ? 2 : 1;
        if (!VALUE_FLAGS_ONE.has(flag) && IGNORED_FLAGS.has(flag) && !flag.startsWith("--") && next && !next.startsWith("-") && !looksLikeUrl(next)) {
          index += 1;
        }
        continue;
      }
      if (next && !next.startsWith("-") && !looksLikeUrl(next)) {
        index += 2;
        continue;
      }
      index += 1;
      continue;
    }
    if (looksLikeUrl(token) || token.includes("://") || token.startsWith("/")) {
      url = token;
      index += 1;
      continue;
    }
    warnings.push(`ignored_token:${token.slice(0, 32)}`);
    index += 1;
  }

  if (!url) {
    throw badRequest("invalid_curl", "cURL is missing a URL");
  }

  const resolvedMethod = assertHttpMethod(method ?? (dataImpliesPost ? "POST" : "GET"));
  return {
    method: resolvedMethod,
    url,
    headers,
    body,
    ignoredFlags: [...new Set(ignoredFlags)],
    warnings,
  };
}

export function suggestInputFields(body: string | null): SuggestedInput[] {
  if (!body) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return [];
  }
  const fields: SuggestedInput[] = [];
  for (const [name, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      continue;
    }
    const inferred = inferType(value);
    if (!inferred) {
      continue;
    }
    fields.push({ name, type: inferred.type, required: true, sample: inferred.sample });
  }
  return fields;
}

export function applyInputMapping(body: string, selected: string[]): { template: string; schema: InputSchema } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw badRequest("invalid_body", "Body must be JSON to map inputs");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw badRequest("invalid_body", "Body must be a JSON object to map inputs");
  }
  const record = parsed as Record<string, unknown>;
  const selectedSet = new Set(selected);
  const fields: InputField[] = [];
  const mapped: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(record)) {
    if (selectedSet.has(name)) {
      const inferred = inferType(value) ?? { type: "string" as const, sample: String(value) };
      fields.push({ name, type: inferred.type, required: true });
      mapped[name] = `{{input.${name}}}`;
    } else {
      mapped[name] = value;
    }
  }
  for (const name of selected) {
    if (!(name in record)) {
      throw badRequest("invalid_input_mapping", `Unknown field ${name}`);
    }
  }
  return { template: JSON.stringify(mapped), schema: { fields } };
}

export function presentParsedCurl(parsed: ParsedCurl) {
  return {
    method: parsed.method,
    url: parsed.url,
    headers: parsed.headers.map((header) => ({
      name: header.name,
      value: header.secret ? header.masked : header.value,
      secret: header.secret,
      secret_reason: header.secretReason,
    })),
    body: parsed.body,
    suggested_inputs: suggestInputFields(parsed.body),
    ignored_flags: parsed.ignoredFlags,
    warnings: parsed.warnings,
  };
}

export function secretNameFromHeader(headerName: string): string {
  return headerName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64) || "secret";
}

function inferType(value: unknown): { type: FieldType; sample: string | number | boolean } | null {
  if (typeof value === "string") {
    return { type: "string", sample: value };
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return { type: "number", sample: value };
  }
  if (typeof value === "boolean") {
    return { type: "boolean", sample: value };
  }
  return null;
}

function parseHeaderLine(line: string): ParsedHeader {
  const idx = line.indexOf(":");
  if (idx === -1) {
    throw badRequest("invalid_curl", "Header must be Name: value");
  }
  const name = line.slice(0, idx).trim();
  const value = line.slice(idx + 1).trim();
  if (name === "") {
    throw badRequest("invalid_curl", "Header name is empty");
  }
  const detected = detectSecretHeader(name, value);
  return {
    name,
    value,
    masked: detected.secret ? secretHint(value) : value,
    secret: detected.secret,
    secretReason: detected.reason,
  };
}

export function detectSecretHeader(name: string, value: string): { secret: boolean; reason?: string } {
  const lower = name.toLowerCase();
  if (SECRET_HEADER_NAMES.has(lower)) {
    return { secret: true, reason: "sensitive_header" };
  }
  if (lower.includes("api-key") || lower.includes("apikey") || lower.endsWith("-key") || lower.includes("token")) {
    return { secret: true, reason: "key_or_token_header" };
  }
  if (/^bearer\s+/i.test(value) || /^basic\s+/i.test(value)) {
    return { secret: true, reason: "credential_scheme" };
  }
  if (/^(sk_live_|sk_test_|rk_live_|rk_test_|ghp_|xox[baprs]-)/.test(value)) {
    return { secret: true, reason: "credential_prefix" };
  }
  return { secret: false };
}

function looksLikeUrl(token: string): boolean {
  return /^https?:\/\//i.test(token);
}

function tokenize(source: string): { tokens: string[]; warnings: string[] } {
  const warnings: string[] = [];
  const joined = source.replace(/\\\r?\n/g, " ");
  const tokens: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;
  let i = 0;

  const flush = () => {
    if (current !== "") {
      if (/\$\(/.test(current) || current.includes("`")) {
        warnings.push("shell_substitution_not_expanded");
      }
      tokens.push(current);
      current = "";
    }
  };

  while (i < joined.length) {
    const ch = joined[i] ?? "";
    if (quote) {
      if (ch === quote) {
        quote = null;
        i += 1;
        continue;
      }
      if (quote === '"' && ch === "\\" && i + 1 < joined.length) {
        current += joined[i + 1];
        i += 2;
        continue;
      }
      current += ch;
      i += 1;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      i += 1;
      continue;
    }
    if (ch === "\\" && i + 1 < joined.length) {
      current += joined[i + 1];
      i += 2;
      continue;
    }
    if (/\s/.test(ch)) {
      flush();
      i += 1;
      continue;
    }
    if (ch === "|" || ch === ";" || ch === ">" || ch === "<" || (ch === "&" && joined[i + 1] === "&")) {
      warnings.push("ignored_shell_operator");
      flush();
      break;
    }
    current += ch;
    i += 1;
  }
  flush();
  if (quote) {
    throw badRequest("invalid_curl", "Unterminated quote in cURL");
  }
  return { tokens, warnings };
}
