export default function IntegrationsPage() {
  return (
    <>
      <h2>Integrations</h2>
      <h1>Channels</h1>
      <div className="card">
        <p>Telegram — adapter in Phase 10. Bot token stored as a secret and never shown full again.</p>
        <p>MCP — same endpoints as tools, Phase 11. No silent spend.</p>
        <p>HTTP 402 — Obscurus-native payment_required, Phase 12.</p>
      </div>
    </>
  );
}
