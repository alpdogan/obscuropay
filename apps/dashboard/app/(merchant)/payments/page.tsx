import { api } from "../../../lib/api.ts";
import { checkoutUrl } from "../../../lib/config.ts";
import { paymentHasWalletField } from "../../../lib/nav.ts";

type Payment = {
  id: string;
  endpoint_id: string | null;
  amount: string;
  asset: string;
  state: string;
  checkout_url: string;
  created_at: number;
};

export default async function PaymentsPage() {
  const data = await api<{ payments: Payment[] }>("/v1/payments");
  if (data.payments.some((payment) => paymentHasWalletField(payment as unknown as Record<string, unknown>))) {
    throw new Error("Customer wallet leaked into merchant payment list");
  }
  return (
    <>
      <h2>Payments</h2>
      <h1>Charges</h1>
      <p className="muted">Customer wallets are not shown. Checkout is a hosted link, not a wallet table.</p>
      <table>
        <thead>
          <tr>
            <th>Payment</th>
            <th>Amount</th>
            <th>State</th>
            <th>Checkout</th>
          </tr>
        </thead>
        <tbody>
          {data.payments.map((payment) => (
            <tr key={payment.id}>
              <td>
                <code>{payment.id}</code>
              </td>
              <td>
                {payment.amount} {payment.asset}
              </td>
              <td>{payment.state}</td>
              <td>
                <a href={checkoutUrl(payment.checkout_url)}>Open</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
