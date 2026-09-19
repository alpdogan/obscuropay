import { readCheckoutConfig } from "../../../lib/config.ts";
import { fetchPayment } from "../../../lib/platform.ts";
import { PayClient } from "./pay-client.tsx";

export default async function PayPage({ params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;
  const config = readCheckoutConfig();
  try {
    const payment = await fetchPayment(config, paymentId);
    return (
      <main>
        <PayClient payment={payment} />
      </main>
    );
  } catch (error) {
    return (
      <main>
        <h2>Obscurus Checkout</h2>
        <h1>This payment is not available.</h1>
        <p className="muted">{error instanceof Error ? error.message : "Payment not found"}</p>
      </main>
    );
  }
}
