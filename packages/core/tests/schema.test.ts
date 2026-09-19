import { describe, expect, it } from "vitest";
import { parseInputSchema, renderTemplate, validateInput } from "../src/endpoint/schema.ts";

describe("input schema", () => {
  it("validates required string fields", () => {
    const schema = parseInputSchema({
      fields: [{ name: "query", type: "string", required: true }],
    });
    expect(validateInput(schema, { query: "John" })).toEqual({ query: "John" });
    expect(() => validateInput(schema, {})).toThrow(/Missing field query/);
  });

  it("renders only input interpolations", () => {
    const body = renderTemplate('{"query":"{{input.query}}","x":"{{env.SECRET}}"}', {
      query: "John",
    });
    expect(body).toBe('{"query":"John","x":"{{env.SECRET}}"}');
  });
});
