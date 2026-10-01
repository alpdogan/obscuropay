export const PAYMENT_RECEIVED_TOPIC =
  "0x02f3d9206e8324bff80077e5b30cb225397f8f786dab7c68cc4e58491eaac44f";

export const BASE_SEPOLIA_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
export const DEFAULT_BASE_SEPOLIA_RPC = "https://sepolia.base.org";

export type ChainLog = {
  address: string;
  topics: string[];
  data: string;
};

export type ExpectedOnchainPayment = {
  contract: string;
  paymentRef: string;
  merchant: string;
  asset: string;
  amount: bigint;
};

export type LogMatch = "matched" | "mismatch" | "pending";

function hex(value: string): string {
  return value.toLowerCase().replace(/^0x/, "");
}

function topicAddress(topic: string): string {
  return `0x${hex(topic).slice(-40)}`;
}

function uint256Word(data: string, index: number): bigint | null {
  const body = hex(data);
  const start = index * 64;
  const word = body.slice(start, start + 64);
  if (word.length !== 64) {
    return null;
  }
  return BigInt(`0x${word}`);
}

export function matchPaymentLogs(logs: readonly ChainLog[], expected: ExpectedOnchainPayment): LogMatch {
  const contract = hex(expected.contract);
  const paymentRef = hex(expected.paymentRef);
  const relevant = logs.filter((log) => {
    const topics = log.topics.map((topic) => topic.toLowerCase());
    return hex(log.address) === contract && topics[0] === PAYMENT_RECEIVED_TOPIC && topics[1] === `0x${paymentRef}`;
  });
  if (relevant.length === 0) {
    return "pending";
  }
  const log = relevant[0];
  if (!log || !log.topics[2] || !log.topics[3]) {
    return "mismatch";
  }
  const amount = uint256Word(log.data, 0);
  const merchant = topicAddress(log.topics[2]);
  const asset = topicAddress(log.topics[3]);
  if (amount === expected.amount && merchant === `0x${hex(expected.merchant)}` && asset === `0x${hex(expected.asset)}`) {
    return "matched";
  }
  return "mismatch";
}

export function developmentMockMatched(input: {
  production: boolean;
  provider: string;
  mockReady: number;
}): boolean {
  if (input.production || input.provider === "base-sepolia") {
    return false;
  }
  return input.mockReady === 1;
}

export function chainSettings(env: Env): { contract: string; rpcUrl: string; usdc: string } | null {
  const contract = env.PAY_CONTRACT?.trim();
  if (!contract) {
    return null;
  }
  return {
    contract,
    rpcUrl: env.CHAIN_RPC_URL?.trim() || DEFAULT_BASE_SEPOLIA_RPC,
    usdc: env.USDC_ADDRESS?.trim() || BASE_SEPOLIA_USDC,
  };
}

export async function fetchPaymentLogs(
  rpcUrl: string,
  contract: string,
  paymentRef: `0x${string}`,
): Promise<ChainLog[]> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getLogs",
      params: [
        {
          address: contract,
          topics: [PAYMENT_RECEIVED_TOPIC, paymentRef],
        },
      ],
    }),
  });
  if (!response.ok) {
    throw new Error(`Base Sepolia RPC returned ${response.status}`);
  }
  const body = (await response.json()) as { result?: ChainLog[]; error?: { message?: string } };
  if (body.error) {
    throw new Error(body.error.message ?? "Base Sepolia RPC rejected eth_getLogs");
  }
  return body.result ?? [];
}
