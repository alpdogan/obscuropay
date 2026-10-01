"use client";

import { useEffect, useState } from "react";
import { readCheckoutConfig } from "../../../lib/config.ts";
import { OBSCURUS_PAY_ABI, USDC_ABI } from "../../../lib/abi.ts";

export function WalletPay(props: {
  disabled: boolean;
  amountUnits: bigint;
  paymentRef: `0x${string}`;
  settlement: string | null;
  onPaid: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void import("./wallet-kit.ts").then(() => {
      if (!cancelled) {
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function pay() {
    if (!props.settlement) {
      props.onError("Merchant has not set a settlement address");
      return;
    }
    setSubmitting(true);
    try {
      const { writeContract } = await import("./wallet-kit.ts");
      const config = readCheckoutConfig();
      if (!config.payContract) {
        throw new Error("Pay contract is not configured");
      }
      await writeContract({
        address: config.usdc,
        abi: USDC_ABI,
        functionName: "approve",
        args: [config.payContract, props.amountUnits],
      });
      await writeContract({
        address: config.payContract,
        abi: OBSCURUS_PAY_ABI,
        functionName: "pay",
        args: [props.paymentRef, props.settlement as `0x${string}`, config.usdc, props.amountUnits],
      });
      await props.onPaid();
    } catch (error) {
      props.onError(error instanceof Error ? error.message : "Wallet payment failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <appkit-button />
      <button type="button" disabled={props.disabled || !ready || submitting} onClick={() => void pay()}>
        Pay with wallet
      </button>
    </>
  );
}
