"use client";

import { amountToTokenUnits, paymentRefToBytes32 } from "@obscurus/core";
import { useMemo, useState } from "react";
import { readCheckoutConfig, walletPayEnabled } from "../../../lib/config.ts";
import { postPayment, type CheckoutPayment } from "../../../lib/platform.ts";
import { PrivacyInspector } from "./privacy-inspector.tsx";
import { WalletPay } from "./wallet-pay.tsx";

const PAID = new Set(["PAID", "FULFILLING", "FULFILLED"]);
const VERIFY_ATTEMPTS = 8;
const VERIFY_DELAY_MS = 1500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function PayClient({ payment }: { payment: CheckoutPayment }) {
  const config = useMemo(() => readCheckoutConfig(), []);
  const [current, setCurrent] = useState(payment);
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const onChain = walletPayEnabled(config);
  const expired = current.state === "EXPIRED";
  const paid = PAID.has(current.state);

  async function finishAfterChain() {
    let latest = current;
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < VERIFY_ATTEMPTS; attempt += 1) {
      try {
        const verified = await postPayment(config, current.id, "verify");
        latest = verified.payment;
        setCurrent(latest);
        lastError = null;
        if (PAID.has(latest.state) || latest.state === "FAILED" || latest.state === "EXPIRED") {
          break;
        }
      } catch (err) {
        lastError = err instanceof Error ? err : new Error("Verification failed");
      }
      if (attempt < VERIFY_ATTEMPTS - 1) {
        await sleep(VERIFY_DELAY_MS);
      }
    }
    if (!PAID.has(latest.state)) {
      if (latest.state === "FAILED") {
        throw new Error("Payment did not match the expected amount, asset, or merchant.");
      }
      throw lastError ?? new Error("Payment is not confirmed yet. Try again in a moment.");
    }
    const fulfilled = await postPayment(config, current.id, "fulfill");
    setCurrent(fulfilled.payment);
    setOutput(fulfilled.invocation?.output_preview ?? "Paid.");
  }

  async function payWithMock() {
    setBusy(true);
    setError(null);
    try {
      await postPayment(config, current.id, "mock-complete");
      await finishAfterChain();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h2>Protected by Obscurus</h2>
      {current.branding?.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="logo"
          src={`${config.platformOrigin}${current.branding.logo_url}`}
          alt={current.branding.display_name ?? current.service_name}
        />
      ) : null}
      <h1>{current.branding?.display_name ?? current.service_name}</h1>
      <div className="card">
        <p className="muted">Pay with a wallet you already have. You do not need an Obscurus account.</p>
        <p className="amount">
          {current.amount} {current.asset}
        </p>
        <p className="muted">State: {current.state}</p>
        {paid ? null : onChain ? (
          <WalletPay
            disabled={busy || expired}
            amountUnits={amountToTokenUnits(current.amount)}
            paymentRef={paymentRefToBytes32(current.payment_ref)}
            settlement={current.settlement_address}
            onPaid={finishAfterChain}
            onError={setError}
          />
        ) : (
          <button type="button" disabled={busy || expired} onClick={() => void payWithMock()}>
            {busy ? "Confirming…" : "Pay with wallet (development mock)"}
          </button>
        )}
        {expired ? <p className="error">This payment expired.</p> : null}
        {error ? <p className="error">{error}</p> : null}
        {output ? <p className="muted">{output}</p> : null}
        <PrivacyInspector amount={current.amount} asset={current.asset} serviceName={current.service_name} />
      </div>
      <p className="footer">No Apple Pay. No cards. No Obscurus wallet. WalletConnect connects; Obscurus verifies.</p>
    </>
  );
}
