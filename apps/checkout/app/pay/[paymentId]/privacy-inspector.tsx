import { buildPrivacyReport } from "../../../lib/privacy.ts";

export function PrivacyInspector(props: { amount: string; asset: string; serviceName: string }) {
  const report = buildPrivacyReport(props);
  return (
    <details className="inspector">
      <summary>{report.title}</summary>
      <section>
        <h2>Shown to the merchant</h2>
        <ul>
          {report.merchant.map((row) => (
            <li key={row.label}>
              <strong>{row.shared ? "Shared" : "Not shared"}.</strong> {row.label} — {row.note}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2>Visible on-chain</h2>
        <ul>
          {report.chain.map((row) => (
            <li key={row.label}>
              <strong>{row.shared ? "Public" : "Not on-chain"}.</strong> {row.label} — {row.note}
            </li>
          ))}
        </ul>
      </section>
      <p>{report.disclaimer}</p>
    </details>
  );
}
