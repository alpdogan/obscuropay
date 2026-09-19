const prefixes = {
  merchant: "merch",
  project: "proj",
  endpoint: "ept",
  secret: "sec",
  invocation: "inv",
  payment: "pay",
  entitlement: "ent",
  session: "sess",
  telegram: "tgint",
} as const;

export type IdKind = keyof typeof prefixes;

export function newId(kind: IdKind): string {
  return `${prefixes[kind]}_${crypto.randomUUID().replaceAll("-", "")}`;
}

export function newPaymentRef(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}
