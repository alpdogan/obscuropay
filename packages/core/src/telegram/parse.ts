import { badRequest } from "../errors.ts";
import { validateInput, type InputSchema } from "../endpoint/schema.ts";

export type TelegramCommand = {
  command: string;
  argument: string;
};

export type TelegramMapping = {
  command: string;
  field: string | null;
};

const COMMAND_RE = /^\/?([a-zA-Z0-9_]+)(?:@[a-zA-Z0-9_]+)?$/;

export function normalizeTelegramCommand(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(COMMAND_RE);
  if (!match?.[1]) {
    throw badRequest("invalid_telegram_command", "Command must look like /search");
  }
  return match[1].toLowerCase();
}

export function parseTelegramText(text: string): TelegramCommand | null {
  const trimmed = text.trim();
  const match = trimmed.match(/^\/([a-zA-Z0-9_]+)(?:@[a-zA-Z0-9_]+)?(?:\s+([\s\S]+))?$/);
  if (!match?.[1]) {
    return null;
  }
  return { command: match[1].toLowerCase(), argument: (match[2] ?? "").trim() };
}

export function parseTelegramMapping(mapping: string): TelegramMapping {
  const field = mapping.match(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/)?.[1] ?? null;
  const commandPart = mapping.replace(/\{\{[^}]*\}\}/g, "").trim().split(/\s+/)[0] ?? "";
  return { command: normalizeTelegramCommand(commandPart), field };
}

export function mapTelegramArgument(
  schema: InputSchema,
  argument: string,
  fieldName?: string | null,
): Record<string, unknown> {
  if (schema.fields.length === 0) {
    if (argument.length > 0) {
      throw badRequest("invalid_input", "This command does not take an argument");
    }
    return {};
  }
  const field =
    (fieldName ? schema.fields.find((item) => item.name === fieldName) : undefined) ??
    (schema.fields.length === 1 ? schema.fields[0] : schema.fields.find((item) => item.required) ?? schema.fields[0]);
  if (!field) {
    throw badRequest("invalid_telegram_mapping", "No input field is mapped for this command");
  }
  return validateInput(schema, { [field.name]: argument });
}

export function formatTelegramCommand(command: string): string {
  return `/${normalizeTelegramCommand(command)}`;
}
