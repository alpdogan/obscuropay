import { conflict } from "../errors.ts";
import type { ImplementedPricingType } from "./pricing.ts";

export const ENTITLEMENT_STATES = ["UNUSED", "CLAIMED"] as const;
export type EntitlementState = (typeof ENTITLEMENT_STATES)[number];

export type Entitlement = {
  id: string;
  merchantId: string;
  endpointId: string;
  invocationId: string;
  paymentId: string;
  pricingType: ImplementedPricingType;
  status: EntitlementState;
  claimedAt: number | null;
  createdAt: number;
};

export function createPerRequestEntitlement(input: {
  id: string;
  merchantId: string;
  endpointId: string;
  invocationId: string;
  paymentId: string;
  createdAt: number;
}): Entitlement {
  return {
    ...input,
    pricingType: "PER_REQUEST",
    status: "UNUSED",
    claimedAt: null,
  };
}

export function claimEntitlement(entitlement: Entitlement, now: number): Entitlement {
  if (entitlement.status === "CLAIMED") {
    throw conflict("entitlement_claimed", "Single-use entitlement cannot execute twice");
  }
  return { ...entitlement, status: "CLAIMED", claimedAt: now };
}

export function isClaimed(entitlement: Entitlement): boolean {
  return entitlement.status === "CLAIMED";
}
