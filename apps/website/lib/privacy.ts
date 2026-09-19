export const PRIVACY_PLANES = [
  {
    id: "service",
    title: "Service data",
    body: "Channel identity used to reply: Telegram chat, MCP session, HTTP caller. Needed by Obscurus. Not sent to the merchant.",
  },
  {
    id: "payment",
    title: "Payment data",
    body: "Wallet, transaction hash, and paymentRef used to verify that you paid. The merchant does not receive a customer wallet by default.",
  },
  {
    id: "blockchain",
    title: "Blockchain data",
    body: "USDC on a public EVM chain is publicly observable. A chain observer can see a wallet send an amount to a settlement address. Omitting a field from JSON does not hide the chain.",
  },
] as const;

export const PRIVACY_KNOWS = [
  {
    party: "Obscurus",
    knows: "Merchant config, encrypted secrets, invocation inputs, service identity, payment identity, and the join required to resume work. Cloudflare runs the computers.",
  },
  {
    party: "Merchant",
    knows: "The operation, the inputs they defined, that payment verified, amount, asset, and request id. Not your wallet, email, phone, name, or Telegram id unless they asked and checkout disclosed it.",
  },
  {
    party: "Blockchain",
    knows: "Payer address, settlement address, amount, asset, time, and an opaque paymentRef. This is a public rail in the MVP.",
  },
  {
    party: "Telegram",
    knows: "User and chat identity, the message, and that a pay link was sent. Telegram’s policy applies. Obscurus does not anonymize you to Telegram.",
  },
  {
    party: "MCP / HTTP",
    knows: "Tool or request arguments, the payment requirement, and the result. An agent that signs with your wallet also sees payment identity.",
  },
] as const;

export const FORBIDDEN_CLAIMS = [
  "untraceable money",
  "anonymous illegal payments",
  "blockchain-level anonymity",
  "sanctions avoidance",
];

export function privacyCopy(): string {
  return [
    "Prove you paid. Not who you are.",
    "Customer → Obscurus → Merchant.",
    "Your payment identity is not shared with the merchant by default.",
    ...PRIVACY_PLANES.map((plane) => `${plane.title}: ${plane.body}`),
    ...PRIVACY_KNOWS.map((row) => `${row.party}: ${row.knows}`),
    "Retention is minimized and subject to legal review. Invocation bodies are proposed for 7 days, then hashed.",
    "Obscurus will not design features whose purpose is to defeat lawful process.",
  ].join("\n");
}
