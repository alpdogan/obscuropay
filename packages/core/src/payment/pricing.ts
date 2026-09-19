import { badRequest } from "../errors.ts";

export const PRICING_TYPES = ["PER_REQUEST", "CREDIT_PACK", "SUBSCRIPTION", "ONE_TIME_UNLOCK"] as const;
export type PricingType = (typeof PRICING_TYPES)[number];
export const IMPLEMENTED_PRICING_TYPES = ["PER_REQUEST"] as const;
export type ImplementedPricingType = (typeof IMPLEMENTED_PRICING_TYPES)[number];

export function parsePricingType(value: unknown): PricingType {
  const type = (value ?? "PER_REQUEST") as string;
  if (!PRICING_TYPES.includes(type as PricingType)) {
    throw badRequest("invalid_pricing_type", "Unknown pricing_type");
  }
  return type as PricingType;
}

export function assertImplementedPricing(type: PricingType): asserts type is ImplementedPricingType {
  if (type !== "PER_REQUEST") {
    throw badRequest("pricing_not_implemented", `${type} is reserved and not implemented`);
  }
}
