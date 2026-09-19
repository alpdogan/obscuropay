import { saveSettlementAction } from "../../../lib/actions.ts";
import { api } from "../../../lib/api.ts";

export default async function SettingsPage() {
  const data = await api<{ merchant: { email: string; settlement_address: string | null } }>("/v1/auth/me");
  return (
    <>
      <h2>Settings</h2>
      <h1>Account</h1>
      <div className="card">
        <p>Email: {data.merchant.email}</p>
        <form action={saveSettlementAction}>
          <label>
            Settlement address (your USDC destination, not a customer wallet)
            <input
              name="settlement_address"
              defaultValue={data.merchant.settlement_address ?? ""}
              placeholder="0x…"
            />
          </label>
          <button type="submit">Save</button>
        </form>
      </div>
    </>
  );
}
