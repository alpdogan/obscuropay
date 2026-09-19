import { saveBrandingAction } from "../../../lib/actions.ts";
import { api } from "../../../lib/api.ts";

export default async function BrandingPage() {
  const data = await api<{
    branding: { display_name: string | null; logo_url: string | null; disclosures_required: boolean };
  }>("/v1/branding");
  return (
    <>
      <h2>Branding</h2>
      <h1>Checkout appearance</h1>
      <p className="muted">
        Logo must be PNG, JPEG, or WebP under 256 KiB. Arbitrary HTML, CSS, and JavaScript are rejected. Obscurus
        disclosures cannot be hidden ({String(data.branding.disclosures_required)}).
      </p>
      <form className="card" action={saveBrandingAction}>
        <label>
          Display name
          <input name="display_name" defaultValue={data.branding.display_name ?? ""} maxLength={80} />
        </label>
        <button type="submit">Save name</button>
      </form>
    </>
  );
}
