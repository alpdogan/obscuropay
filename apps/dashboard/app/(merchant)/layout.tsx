import Link from "next/link";
import type { ReactNode } from "react";
import { logoutAction } from "../../lib/actions.ts";
import { api } from "../../lib/api.ts";
import { MERCHANT_NAV } from "../../lib/nav.ts";

export default async function MerchantLayout({ children }: { children: ReactNode }) {
  const me = await api<{ merchant: { email: string } }>("/v1/auth/me");
  return (
    <div className="shell">
      <nav>
        <strong>Obscurus</strong>
        {MERCHANT_NAV.map((item) => (
          <Link key={item.href} href={item.href}>
            {item.label}
          </Link>
        ))}
        <p className="muted">{me.merchant.email}</p>
        <form action={logoutAction}>
          <button className="secondary" type="submit">
            Sign out
          </button>
        </form>
      </nav>
      <main>{children}</main>
    </div>
  );
}
