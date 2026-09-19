import { badRequest } from "../errors.ts";

export const RESPONSE_MODES = ["passthrough", "jsonpath", "template"] as const;
export type ResponseMode = (typeof RESPONSE_MODES)[number];

export type ResponseMapping = {
  mode: ResponseMode;
  select?: string | null;
  template?: string | null;
};

export function parseResponseMapping(value: unknown): ResponseMapping {
  if (value === undefined || value === null) {
    return { mode: "passthrough" };
  }
  if (typeof value !== "object") {
    throw badRequest("invalid_response_mapping", "response mapping must be an object");
  }
  const rec = value as Record<string, unknown>;
  const mode = (rec.mode ?? "passthrough") as string;
  if (!RESPONSE_MODES.includes(mode as ResponseMode)) {
    throw badRequest("invalid_response_mapping", "mode must be passthrough, jsonpath, or template");
  }
  return {
    mode: mode as ResponseMode,
    select: typeof rec.select === "string" ? rec.select : null,
    template: typeof rec.template === "string" ? rec.template : null,
  };
}

export function transformResponse(raw: string, mapping: ResponseMapping): string {
  if (mapping.mode === "passthrough") {
    return raw;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw badRequest("invalid_response", "Merchant response is not JSON");
  }
  if (mapping.mode === "jsonpath") {
    if (!mapping.select) {
      throw badRequest("invalid_response_mapping", "jsonpath mode needs select");
    }
    const selected = selectPath(parsed, mapping.select);
    return selected === undefined ? "null" : JSON.stringify(selected);
  }
  if (!mapping.template) {
    throw badRequest("invalid_response_mapping", "template mode needs template");
  }
  return renderResponseTemplate(mapping.template, parsed);
}

export function selectPath(root: unknown, path: string): unknown {
  const normalized = path.trim().replace(/^\$\.?/, "");
  if (normalized === "" || normalized === "$") {
    return root;
  }
  const parts = [...normalized.matchAll(/([^[.\]]+)|\[(\d+)\]/g)].map((m) => m[1] ?? m[2]!);
  let current: unknown = root;
  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (/^\d+$/.test(part)) {
      if (!Array.isArray(current)) {
        return undefined;
      }
      current = current[Number(part)];
      continue;
    }
    if (typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function renderResponseTemplate(template: string, root: unknown): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.$\[\]]+)\s*\}\}/g, (_, path: string) => {
    const value = selectPath(root, path);
    if (value === undefined || value === null) {
      return "";
    }
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    return JSON.stringify(value);
  });
}
