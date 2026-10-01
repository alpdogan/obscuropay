import { describe, expect, it } from "vitest";
import {
  BASE_SEPOLIA_USDC,
  PAYMENT_RECEIVED_TOPIC,
  developmentMockMatched,
  matchPaymentLogs,
  type ChainLog,
} from "../src/chain/payment-log.ts";

const CONTRACT = "0x1111111111111111111111111111111111111111";
const MERCHANT = "0x2222222222222222222222222222222222222222";
const PAYMENT_REF = "ab".repeat(32);
const AMOUNT = 250_000n;
const FEE = 2_500n;

function word(value: bigint): string {
  return value.toString(16).padStart(64, "0");
}

function topicAddress(address: string): string {
  return `0x${address.toLowerCase().replace(/^0x/, "").padStart(64, "0")}`;
}

function log(overrides: Partial<ChainLog> = {}): ChainLog {
  return {
    address: CONTRACT,
    topics: [
      PAYMENT_RECEIVED_TOPIC,
      `0x${PAYMENT_REF}`,
      topicAddress(MERCHANT),
      topicAddress(BASE_SEPOLIA_USDC),
    ],
    data: `0x${word(AMOUNT)}${word(FEE)}`,
    ...overrides,
  };
}

const expected = {
  contract: CONTRACT,
  paymentRef: PAYMENT_REF,
  merchant: MERCHANT,
  asset: BASE_SEPOLIA_USDC,
  amount: AMOUNT,
};

describe("PaymentReceived logs", () => {
  it("matches payment ref, merchant, asset, and amount", () => {
    expect(matchPaymentLogs([log()], expected)).toBe("matched");
  });

  it("stays pending when the log is not visible yet", () => {
    expect(matchPaymentLogs([], expected)).toBe("pending");
  });

  it("rejects a different amount", () => {
    expect(matchPaymentLogs([log({ data: `0x${word(1n)}${word(FEE)}` })], expected)).toBe("mismatch");
  });

  it("rejects a different merchant", () => {
    const topics = [...log().topics];
    topics[2] = topicAddress("0x3333333333333333333333333333333333333333");
    expect(matchPaymentLogs([log({ topics })], expected)).toBe("mismatch");
  });

  it("ignores logs from another contract", () => {
    expect(matchPaymentLogs([log({ address: "0x4444444444444444444444444444444444444444" })], expected)).toBe(
      "pending",
    );
  });
});

describe("development mock confirmation", () => {
  it("confirms only a development mock that was marked ready", () => {
    expect(developmentMockMatched({ production: false, provider: "mock", mockReady: 1 })).toBe(true);
    expect(developmentMockMatched({ production: true, provider: "mock", mockReady: 1 })).toBe(false);
    expect(developmentMockMatched({ production: false, provider: "base-sepolia", mockReady: 1 })).toBe(false);
    expect(developmentMockMatched({ production: false, provider: "mock", mockReady: 0 })).toBe(false);
  });
});
