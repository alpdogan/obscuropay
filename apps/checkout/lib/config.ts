export type CheckoutConfig = {
  platformOrigin: string;
  walletConnectProjectId: string;
  payContract: `0x${string}` | "";
  usdc: `0x${string}`;
  chainId: number;
};

export function readCheckoutConfig(env: Record<string, string | undefined> = process.env): CheckoutConfig {
  const chainId = Number(env.NEXT_PUBLIC_CHAIN_ID ?? "84532");
  return {
    platformOrigin: (env.NEXT_PUBLIC_PLATFORM_ORIGIN ?? "http://localhost:8787").replace(/\/$/, ""),
    walletConnectProjectId: env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "",
    payContract: (env.NEXT_PUBLIC_PAY_CONTRACT ?? "") as CheckoutConfig["payContract"],
    usdc: (env.NEXT_PUBLIC_USDC ?? "0x036CbD53842c5426634e7929541eC2318f3dCF7e") as `0x${string}`,
    chainId: Number.isFinite(chainId) ? chainId : 84532,
  };
}

export function walletPayEnabled(config: CheckoutConfig): boolean {
  return Boolean(config.walletConnectProjectId && config.payContract);
}

export function platformUrl(config: CheckoutConfig, path: string): string {
  return `${config.platformOrigin}${path.startsWith("/") ? path : `/${path}`}`;
}
