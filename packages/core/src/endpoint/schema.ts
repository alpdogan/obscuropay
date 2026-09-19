import { badRequest } from "../errors.ts";

export const FIELD_TYPES = ["string", "number", "boolean", "enum"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export type InputField = {
  name: string;
  type: FieldType;
  required: boolean;
  options?: string[];
};

export type InputSchema = {
  fields: InputField[];
};

const NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export function parseInputSchema(value: unknown): InputSchema {
  if (!value || typeof value !== "object" || !("fields" in value) || !Array.isArray(value.fields)) {
    throw badRequest("invalid_input_schema", "input_schema.fields must be an array");
  }
  const seen = new Set<string>();
  const fields: InputField[] = value.fields.map((raw, index) => {
    if (!raw || typeof raw !== "object") {
      throw badRequest("invalid_input_schema", `Field ${index} is invalid`);
    }
    const rec = raw as Record<string, unknown>;
    const name = rec.name;
    const type = rec.type;
    if (typeof name !== "string" || !NAME_RE.test(name)) {
      throw badRequest("invalid_input_schema", `Field ${index} has an invalid name`);
    }
    if (seen.has(name)) {
      throw badRequest("invalid_input_schema", `Duplicate field ${name}`);
    }
    seen.add(name);
    if (!FIELD_TYPES.includes(type as FieldType)) {
      throw badRequest("invalid_input_schema", `Field ${name} has an unsupported type`);
    }
    const field: InputField = {
      name,
      type: type as FieldType,
      required: rec.required !== false,
    };
    if (field.type === "enum") {
      if (!Array.isArray(rec.options) || rec.options.length === 0 || rec.options.some((o) => typeof o !== "string")) {
        throw badRequest("invalid_input_schema", `Field ${name} needs string enum options`);
      }
      field.options = rec.options as string[];
    }
    return field;
  });
  return { fields };
}

export function validateInput(schema: InputSchema, input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of schema.fields) {
    const value = input[field.name];
    if (value === undefined || value === null || value === "") {
      if (field.required) {
        throw badRequest("invalid_input", `Missing field ${field.name}`);
      }
      continue;
    }
    out[field.name] = coerceField(field, value);
  }
  return out;
}

function coerceField(field: InputField, value: unknown): unknown {
  switch (field.type) {
    case "string":
      if (typeof value !== "string") {
        throw badRequest("invalid_input", `${field.name} must be a string`);
      }
      return value;
    case "number":
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw badRequest("invalid_input", `${field.name} must be a number`);
      }
      return value;
    case "boolean":
      if (typeof value !== "boolean") {
        throw badRequest("invalid_input", `${field.name} must be a boolean`);
      }
      return value;
    case "enum":
      if (typeof value !== "string" || !field.options?.includes(value)) {
        throw badRequest("invalid_input", `${field.name} must be one of the allowed values`);
      }
      return value;
    default:
      throw badRequest("invalid_input", `${field.name} has an unsupported type`);
  }
}

export function renderTemplate(template: string, input: Record<string, unknown>): string {
  return template.replace(/\{\{\s*input\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (_, name: string) => {
    const value = input[name];
    if (value === undefined || value === null) {
      return "";
    }
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    return JSON.stringify(value);
  });
}

export type HeaderSpec =
  | { name: string; value: string }
  | { name: string; secretId: string };

export function parseHeaders(value: unknown): HeaderSpec[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw badRequest("invalid_headers", "headers must be an array");
  }
  return value.map((raw, index) => {
    if (!raw || typeof raw !== "object") {
      throw badRequest("invalid_headers", `Header ${index} is invalid`);
    }
    const rec = raw as Record<string, unknown>;
    if (typeof rec.name !== "string" || rec.name.trim() === "") {
      throw badRequest("invalid_headers", `Header ${index} needs a name`);
    }
    if (typeof rec.secretId === "string") {
      return { name: rec.name, secretId: rec.secretId };
    }
    if (typeof rec.secret_id === "string") {
      return { name: rec.name, secretId: rec.secret_id };
    }
    if (typeof rec.value !== "string") {
      throw badRequest("invalid_headers", `Header ${rec.name} needs a value or secret_id`);
    }
    return { name: rec.name, value: rec.value };
  });
}

export function slugify(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (slug.length < 1 || slug.length > 64) {
    throw badRequest("invalid_name", "Name must produce a slug between 1 and 64 characters");
  }
  return slug;
}

export function assertPriceAmount(amount: string): string {
  if (!/^\d+(\.\d{1,6})?$/.test(amount)) {
    throw badRequest("invalid_price", "price_amount must be a decimal string");
  }
  return amount;
}
