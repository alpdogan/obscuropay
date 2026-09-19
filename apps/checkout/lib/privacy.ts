export type PrivacyRow = {
  label: string;
  shared: boolean;
  note: string;
};

export type PrivacyReport = {
  title: string;
  merchant: PrivacyRow[];
  chain: PrivacyRow[];
  disclaimer: string;
};

export function buildPrivacyReport(input: { amount: string; asset: string; serviceName: string }): PrivacyReport {
  return {
    title: "What is shared?",
    merchant: [
      { label: "Paid amount and asset", shared: true, note: `${input.amount} ${input.asset}` },
      { label: "Service requested", shared: true, note: input.serviceName },
      { label: "Request input you typed", shared: true, note: "Needed to run the API" },
      { label: "Your wallet address", shared: false, note: "Obscurus does not send it to the merchant" },
      { label: "Email, name, or Telegram id", shared: false, note: "Not collected for checkout" },
    ],
    chain: [
      { label: "Payer wallet → merchant settlement", shared: true, note: "Visible on a public EVM explorer" },
      { label: "Opaque paymentRef, amount, asset, fee", shared: true, note: "Settlement fields only" },
      { label: "Query text, API URL, or personal data", shared: false, note: "Never written on-chain" },
    ],
    disclaimer:
      "This is data minimization, not untraceable money. A public observer can still see a wallet send USDC to a merchant.",
  };
}
