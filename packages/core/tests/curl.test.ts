import { describe, expect, it } from "vitest";
import {
  applyInputMapping,
  parseCurl,
  presentParsedCurl,
  suggestInputFields,
} from "../src/curl/parse.ts";

const SAMPLE = `curl -X POST https://api.example.com/search \\
  -H "Authorization: Bearer SECRET" \\
  -H "Content-Type: application/json" \\
  -d '{
    "query": "john"
  }'`;

describe("parseCurl", () => {
  it("parses method, url, headers, and JSON body", () => {
    const parsed = parseCurl(SAMPLE);
    expect(parsed.method).toBe("POST");
    expect(parsed.url).toBe("https://api.example.com/search");
    expect(parsed.headers).toHaveLength(2);
    expect(parsed.headers[0]?.secret).toBe(true);
    expect(parsed.headers[0]?.masked).toBe("••••CRET");
    expect(parsed.headers[1]?.secret).toBe(false);
    expect(parsed.body).toContain("john");
  });

  it("defaults to POST when -d is present without -X", () => {
    const parsed = parseCurl(`curl https://api.example.com/x -d '{"a":1}'`);
    expect(parsed.method).toBe("POST");
  });

  it("defaults to GET without body", () => {
    const parsed = parseCurl("curl https://api.example.com/health");
    expect(parsed.method).toBe("GET");
    expect(parsed.body).toBeNull();
  });

  it("masks secrets in the public presentation", () => {
    const view = presentParsedCurl(parseCurl(SAMPLE));
    expect(JSON.stringify(view)).not.toContain("Bearer SECRET");
    expect(view.headers[0]?.value).toBe("••••CRET");
    expect(view.suggested_inputs).toEqual([
      { name: "query", type: "string", required: true, sample: "john" },
    ]);
  });

  it("does not execute shell, pipes, or substitutions", () => {
    const parsed = parseCurl(
      `curl https://api.example.com/ok -H "X-Test: 1" | sh -c "rm -rf /" && echo $(whoami)`,
    );
    expect(parsed.url).toBe("https://api.example.com/ok");
    expect(parsed.warnings).toContain("ignored_shell_operator");
    expect(parsed.headers).toHaveLength(1);
  });

  it("records but does not expand backticks or $()", () => {
    const parsed = parseCurl(`curl https://api.example.com/ok -H "X-Evil: $(whoami)"`);
    expect(parsed.warnings).toContain("shell_substitution_not_expanded");
    expect(parsed.headers[0]?.value).toBe("$(whoami)");
  });

  it("ignores output flags instead of writing files", () => {
    const parsed = parseCurl("curl https://api.example.com/ok -o /tmp/pwned.txt");
    expect(parsed.url).toBe("https://api.example.com/ok");
    expect(parsed.ignoredFlags).toContain("-o");
  });
});

describe("input mapping", () => {
  it("suggests primitive JSON fields", () => {
    expect(suggestInputFields('{"query":"john","limit":10,"ok":true}')).toEqual([
      { name: "query", type: "string", required: true, sample: "john" },
      { name: "limit", type: "number", required: true, sample: 10 },
      { name: "ok", type: "boolean", required: true, sample: true },
    ]);
  });

  it("converts selected literals into input templates", () => {
    const mapped = applyInputMapping('{"query":"john","fixed":"acme"}', ["query"]);
    expect(mapped.template).toBe('{"query":"{{input.query}}","fixed":"acme"}');
    expect(mapped.schema.fields).toEqual([{ name: "query", type: "string", required: true }]);
  });
});
