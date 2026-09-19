import Link from "next/link";
import { registerAction } from "../../lib/actions.ts";

export default function RegisterPage() {
  return (
    <main className="gate">
      <h2>Obscurus</h2>
      <h1>Create a merchant account</h1>
      <form className="card" action={registerAction}>
        <label>
          Email
          <input name="email" type="email" required />
        </label>
        <label>
          Password
          <input name="password" type="password" required minLength={8} />
        </label>
        <button type="submit">Create account</button>
      </form>
      <p className="muted">
        Already registered? <Link href="/login">Sign in</Link>
      </p>
    </main>
  );
}
