"use client";

import { useMemo, useState } from "react";
import { readCheckoutConfig, walletPayEnabled } from "../../../lib/config.ts";
import { postPayment, type CheckoutPayment } from "../../../lib/platform.ts";

export function PayClient({ payment }: { payment: CheckoutPayment }) {
  const config = useMemo(() => readCheckoutConfig(), []);
  const [current, setCurrent] = useState(payment);
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const onChain = walletPayEnabled(config);
  const expired = current.state === "EXPIRED";
  const paid = current.state === "PAID" || current.state === "FULFILLING" || current.state === "FULFILLED";

  async function finishAfterChain() {
    const verified = await postPayment(config, current.id, "verify");
    setCurrent(verified.payment);
    const fulfilled = await postPayment(config, current.id, "fulfill");
    setCurrent(fulfilled.payment);
    setOutput(fulfilled.invocation?.output_preview ?? "Paid.");
  }

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      if (onChain) {
        throw new Error("WalletConnect AppKit is configured. Use wallet-kit.ts after the pay contract is deployed.");
      } else {
        await postPayment(config, current.id, "mock-complete");
      }
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
      <h1>{current.service_name}</h1>
      <div className="card">
        <p className="muted">Pay with a wallet you already have. You do not need an Obscurus account.</p>
        <p className="amount">
          {current.amount} {current.asset}
        </p>
        <p className="muted">State: {current.state}</p>
        {paid ? null : (
          <button type="button" disabled={busy || expired} onClick={() => void pay()}>
            {busy ? "Confirming…" : onChain ? "Pay with wallet" : "Pay with wallet (development mock)"}
          </button>
        )}
        {expired ? <p className="error">This payment expired.</p> : null}
        {error ? <p className="error">{error}</p> : null}
        {output ? <p className="muted">{output}</p> : null}
        <details>
          <summary>What is shared?</summary>
          <p>
            The merchant receives that you paid {current.amount} {current.asset} and your request input. They do not
            receive your wallet address from Obscurus. The payment itself is visible on a public chain. This is not
            untraceable money.
          </p>
        </details>
      </div>
      <p className="footer">No Apple Pay. No cards. No Obscurus wallet. WalletConnect connects; Obscurus verifies.</p>
    </>
  );
}
