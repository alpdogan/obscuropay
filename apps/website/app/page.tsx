import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <nav>
        <Link href="/">Obscurus</Link>
        <Link href="/privacy">Privacy</Link>
      </nav>
      <h2>Obscurus Pay</h2>
      <h1>Prove you paid. Not who you are.</h1>
      <p className="muted">
        Privacy-first payment infrastructure for APIs, bots, and autonomous software. Paste an existing HTTP API,
        set a price, and publish it through Telegram, MCP, HTTP 402, or hosted checkout.
      </p>
      <p>
        <Link href="/privacy">Read the public privacy center</Link>
      </p>
    </main>
  );
}
