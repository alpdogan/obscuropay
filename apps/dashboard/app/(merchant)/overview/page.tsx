import { api } from "../../../lib/api.ts";

export default async function OverviewPage() {
  const [endpoints, payments, invocations] = await Promise.all([
    api<{ endpoints: unknown[] }>("/v1/endpoints"),
    api<{ payments: unknown[] }>("/v1/payments"),
    api<{ invocations: unknown[] }>("/v1/invocations"),
  ]);
  return (
    <>
      <h2>Overview</h2>
      <h1>Prove you paid. Not who you are.</h1>
      <div className="grid">
        <article className="card">
          <h2>Endpoints</h2>
          <p>{endpoints.endpoints.length}</p>
        </article>
        <article className="card">
          <h2>Payments</h2>
          <p>{payments.payments.length}</p>
        </article>
        <article className="card">
          <h2>Invocations</h2>
          <p>{invocations.invocations.length}</p>
        </article>
      </div>
      <p className="muted">This console never lists a customer wallet. Settlement is your address, not theirs.</p>
    </>
  );
}
