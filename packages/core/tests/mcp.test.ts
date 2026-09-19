import { describe, expect, it } from "vitest";
import {
  assertNoSilentMcpSpend,
  endpointToMcpTool,
  parseMcpSpendingPolicy,
} from "../src/mcp/tools.ts";

describe("mcp tools", () => {
  it("exposes the same endpoint as a tool with price metadata and no chain details", () => {
    const tool = endpointToMcpTool({
      slug: "person_search",
      name: "person search",
      inputSchema: { fields: [{ name: "query", type: "string", required: true }] },
      priceAmount: "0.50",
      priceAsset: "USDC",
      pricingType: "PER_REQUEST",
    });
    expect(tool.name).toBe("person_search");
    expect(tool.inputSchema.required).toEqual(["query"]);
    expect(tool._meta.obscurus).toEqual({
      amount: "0.50",
      asset: "USDC",
      pricing_type: "PER_REQUEST",
      silent_spend: false,
    });
    expect(JSON.stringify(tool)).not.toMatch(/wallet|0x[a-fA-F0-9]{40}|chainId/);
  });

  it("rejects silent spend flags and reserved auto-pay policy", () => {
    expect(() => assertNoSilentMcpSpend({ name: "person_search", paid: true })).toThrow(/cannot spend/);
    expect(() => parseMcpSpendingPolicy({ auto_spend: true })).toThrow(/Automatic MCP spend/);
    expect(parseMcpSpendingPolicy({ max_per_call: "0.05", max_per_day: "1.00" })).toEqual({
      max_per_call: "0.05",
      max_per_day: "1.00",
    });
  });
});
