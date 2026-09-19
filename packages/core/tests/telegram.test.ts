import { describe, expect, it } from "vitest";
import {
  formatTelegramCommand,
  mapTelegramArgument,
  normalizeTelegramCommand,
  parseTelegramMapping,
  parseTelegramText,
} from "../src/telegram/parse.ts";

const QUERY_SCHEMA = { fields: [{ name: "query", type: "string" as const, required: true }] };

describe("telegram command parsing", () => {
  it("maps /search John Smith onto the query field", () => {
    const parsed = parseTelegramText("/search John Smith");
    expect(parsed).toEqual({ command: "search", argument: "John Smith" });
    expect(mapTelegramArgument(QUERY_SCHEMA, parsed?.argument ?? "", "query")).toEqual({ query: "John Smith" });
  });

  it("strips a bot mention and empty arguments", () => {
    expect(parseTelegramText("/search@AcmeBot")).toEqual({ command: "search", argument: "" });
    expect(normalizeTelegramCommand("/SEARCH")).toBe("search");
    expect(formatTelegramCommand("search")).toBe("/search");
  });

  it("reads /search {{query}} mappings", () => {
    expect(parseTelegramMapping("/search {{query}}")).toEqual({ command: "search", field: "query" });
  });

  it("returns null for ordinary chat", () => {
    expect(parseTelegramText("hello")).toBeNull();
  });
});
