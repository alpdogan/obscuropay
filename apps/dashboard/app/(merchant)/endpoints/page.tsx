import Link from "next/link";
import { api } from "../../../lib/api.ts";

type Endpoint = {
  id: string;
  name: string;
  method: string;
  slug: string;
  pricing: { amount: string; asset: string };
};

export default async function EndpointsPage() {
  const data = await api<{ endpoints: Endpoint[] }>("/v1/endpoints");
  return (
    <>
      <h2>Endpoints</h2>
      <h1>Monetized APIs</h1>
      <p>
        <Link href="/endpoints/new">Import from cURL</Link>
      </p>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Method</th>
            <th>Price</th>
          </tr>
        </thead>
        <tbody>
          {data.endpoints.map((endpoint) => (
            <tr key={endpoint.id}>
              <td>
                <Link href={`/endpoints/${endpoint.id}`}>{endpoint.name}</Link>
              </td>
              <td>
                {endpoint.method} /{endpoint.slug}
              </td>
              <td>
                {endpoint.pricing.amount} {endpoint.pricing.asset}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
