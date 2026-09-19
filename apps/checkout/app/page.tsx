export default function HomePage() {
  return (
    <main>
      <h2>Obscurus Checkout</h2>
      <h1>Prove you paid. Not who you are.</h1>
      <div className="card">
        <p className="muted">
          Customers open a payment at <code>/pay/&#123;payment_id&#125;</code>. There is no Obscurus account, Apple Pay,
          card form, or custodial wallet.
        </p>
      </div>
    </main>
  );
}
