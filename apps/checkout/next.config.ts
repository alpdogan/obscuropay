import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@obscurus/core"],
  webpack: (config) => {
    // Reown's wagmi adapter optionally imports Coinbase x402 modules that are not installed.
    // Obscurus verifies ObscurusPay itself and does not use an x402 facilitator.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@base-org/account": false,
      "@coinbase/wallet-sdk": false,
      "@coinbase/cdp-sdk": false,
      "@gemini-wallet/core": false,
      "@metamask/sdk": false,
      "@safe-global/safe-apps-provider": false,
      "@safe-global/safe-apps-sdk": false,
      porto: false,
    };
    return config;
  },
};

export default nextConfig;
