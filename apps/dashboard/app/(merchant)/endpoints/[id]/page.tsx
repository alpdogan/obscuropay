import { api } from "../../../../lib/api.ts";

export default async function EndpointDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { endpoint } = await api<{
    endpoint: {
      name: string;
      method: string;
      url: string;
      pricing: { amount: string; asset: string };
      response: { mode: string };
      input_schema: { fields: { name: string }[] };
    };
  }>(`/v1/endpoints/${id}`);
  return (
    <>
      <h2>Endpoint</h2>
      <h1>{endpoint.name}</h1>
      <div className="card">
        <p>
          {endpoint.method} <code>{endpoint.url}</code>
        </p>
        <p>
          {endpoint.pricing.amount} {endpoint.pricing.asset} · response {endpoint.response.mode}
        </p>
        <p className="muted">Inputs: {endpoint.input_schema.fields.map((field) => field.name).join(", ") || "none"}</p>
      </div>
    </>
  );
}
