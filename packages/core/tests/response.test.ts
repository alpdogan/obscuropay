import { describe, expect, it } from "vitest";
import { selectPath, transformResponse } from "../src/endpoint/response.ts";

const SAMPLE = JSON.stringify({
  success: true,
  data: { name: "John", company: "Acme" },
  items: [{ id: 1 }],
});

describe("response mapping", () => {
  it("passes JSON through", () => {
    expect(transformResponse(SAMPLE, { mode: "passthrough" })).toBe(SAMPLE);
  });

  it("selects a JSONPath-style value", () => {
    expect(selectPath(JSON.parse(SAMPLE), "$.data.name")).toBe("John");
    expect(transformResponse(SAMPLE, { mode: "jsonpath", select: "data.company" })).toBe('"Acme"');
    expect(transformResponse(SAMPLE, { mode: "jsonpath", select: "items[0].id" })).toBe("1");
  });

  it("renders a text template", () => {
    expect(
      transformResponse(SAMPLE, {
        mode: "template",
        template: "Name: {{data.name}}\nCompany: {{data.company}}",
      }),
    ).toBe("Name: John\nCompany: Acme");
  });
});
