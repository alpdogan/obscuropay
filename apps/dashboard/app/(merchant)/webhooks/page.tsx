export default function WebhooksPage() {
  return (
    <>
      <h2>Webhooks</h2>
      <h1>Merchant callbacks</h1>
      <div className="card">
        <p>Signed webhooks ship in Phase 13: HMAC <code>X-Obscurus-Signature</code>, timestamp, retries.</p>
        <p className="muted">Payloads will not include a customer wallet by default.</p>
      </div>
    </>
  );
}
