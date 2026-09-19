import Link from "next/link";
import { loginAction } from "../../lib/actions.ts";

export default function LoginPage() {
  return (
    <main className="gate">
      <h2>Obscurus</h2>
      <h1>Merchant sign in</h1>
      <p className="muted">Customers never sign in here. This console does not list customer wallets.</p>
      <form className="card" action={loginAction}>
        <label>
          Email
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>
          Password
          <input name="password" type="password" required autoComplete="current-password" />
        </label>
        <button type="submit">Sign in</button>
      </form>
      <p className="muted">
        New merchant? <Link href="/register">Create an account</Link>
      </p>
    </main>
  );
}
