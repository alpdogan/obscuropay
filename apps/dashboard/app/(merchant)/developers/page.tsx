export default function DevelopersPage() {
  return (
    <>
      <h2>Developers</h2>
      <h1>Merchant API</h1>
      <div className="card">
        <p>Session cookie: <code>obscurus_session</code> (HttpOnly).</p>
        <p>
          Paid invoke: <code>POST /v1/invoke</code> then hosted <code>/pay/&#123;payment_id&#125;</code>.
        </p>
        <p className="muted">List and webhook payloads do not include customer wallets by default.</p>
      </div>
    </>
  );
}
