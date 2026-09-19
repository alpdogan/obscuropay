import { badRequest } from "../errors.ts";

export const USDC_DECIMALS = 6;

export function amountToTokenUnits(amount: string, decimals = USDC_DECIMALS): bigint {
  if (!/^\d+(\.\d+)?$/.test(amount)) {
    throw badRequest("invalid_amount", "amount must be a decimal string");
  }
  const [whole = "0", fraction = ""] = amount.split(".");
  if (fraction.length > decimals) {
    throw badRequest("invalid_amount", `amount has more than ${decimals} decimal places`);
  }
  const padded = fraction.padEnd(decimals, "0");
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(padded || "0");
}

export function paymentRefToBytes32(paymentRef: string): `0x${string}` {
  if (!/^[0-9a-fA-F]{64}$/.test(paymentRef)) {
    throw badRequest("invalid_payment_ref", "payment_ref must be 32 bytes hex");
  }
  return `0x${paymentRef.toLowerCase()}`;
}

export function assertEvmAddress(value: string): `0x${string}` {
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw badRequest("invalid_settlement_address", "settlement_address must be a 20-byte 0x address");
  }
  return value as `0x${string}`;
}
