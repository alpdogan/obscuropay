import Link from "next/link";
import { PRIVACY_KNOWS, PRIVACY_PLANES } from "../../lib/privacy.ts";

export const metadata = {
  title: "Privacy — Obscurus",
  description: "What Obscurus knows, what the merchant knows, and what the chain may reveal.",
};

export default function PrivacyPage() {
  return (
    <main>
      <nav>
        <Link href="/">Obscurus</Link>
        <Link href="/privacy">Privacy</Link>
      </nav>
      <h2>Privacy center</h2>
      <h1>Prove you paid. Not who you are.</h1>
      <p className="muted">
        Your payment identity is not shared with the merchant by default. That is data minimization between Obscurus
        and the merchant. It is not a claim that money on a public chain is anonymous.
      </p>
      <div className="flow" aria-label="Customer to merchant">
        <span>Customer</span>
        <span>Obscurus</span>
        <span>Merchant</span>
      </div>
      {PRIVACY_PLANES.map((plane) => (
        <div className="card" key={plane.id}>
          <h2>{plane.title}</h2>
          <p className="muted">{plane.body}</p>
        </div>
      ))}
      {PRIVACY_KNOWS.map((row) => (
        <div className="card" key={row.party}>
          <h2>What {row.party} knows</h2>
          <p className="muted">{row.knows}</p>
        </div>
      ))}
      <div className="card">
        <h2>Retention</h2>
        <p className="muted">
          Proposed defaults, subject to legal review: invocation bodies 7 days then hash; service identity hashed at
          rest for disputes and abuse, never shown to merchants; secrets as ciphertext until deleted. Compelled
          disclosure of what was actually stored is a legal matter. Obscurus will not design features whose purpose is
          to defeat lawful process.
        </p>
      </div>
    </main>
  );
}
