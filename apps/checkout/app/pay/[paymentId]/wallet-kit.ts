import { amountToTokenUnits, paymentRefToBytes32 } from "@obscurus/core";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { createAppKit } from "@reown/appkit/react";
import { baseSepolia } from "@reown/appkit/networks";
import { writeContract as wagmiWriteContract } from "wagmi/actions";
import { OBSCURUS_PAY_ABI, USDC_ABI } from "../../../lib/abi.ts";
import { readCheckoutConfig } from "../../../lib/config.ts";

const config = readCheckoutConfig();
const networks = [baseSepolia] as const;

const wagmiAdapter = new WagmiAdapter({
  networks: [...networks],
  projectId: config.walletConnectProjectId,
  ssr: false,
});

if (config.walletConnectProjectId) {
  createAppKit({
    adapters: [wagmiAdapter],
    networks: [...networks],
    projectId: config.walletConnectProjectId,
    metadata: {
      name: "Obscurus Checkout",
      description: "Prove you paid. Not who you are.",
      url: typeof window === "undefined" ? "http://localhost:3000" : window.location.origin,
      icons: [],
    },
    features: {
      analytics: false,
      email: false,
      socials: false,
      onramp: false,
      swaps: false,
    },
  });
}

export async function writeContract(parameters: {
  address: `0x${string}`;
  abi: readonly unknown[];
  functionName: string;
  args: readonly unknown[];
}): Promise<`0x${string}`> {
  const write = wagmiWriteContract as unknown as (
    config: unknown,
    params: typeof parameters,
  ) => Promise<`0x${string}`>;
  return write(wagmiAdapter.wagmiConfig, parameters);
}

export async function payWithWallet(input: {
  amount: string;
  paymentRef: string;
  settlement: string | null;
}): Promise<void> {
  if (!input.settlement) {
    throw new Error("Merchant has not set a settlement address");
  }
  const local = readCheckoutConfig();
  if (!local.payContract) {
    throw new Error("Pay contract is not configured");
  }
  const amount = amountToTokenUnits(input.amount);
  await writeContract({
    address: local.usdc,
    abi: USDC_ABI,
    functionName: "approve",
    args: [local.payContract, amount],
  });
  await writeContract({
    address: local.payContract,
    abi: OBSCURUS_PAY_ABI,
    functionName: "pay",
    args: [paymentRefToBytes32(input.paymentRef), input.settlement, local.usdc, amount],
  });
}
