import { api } from "../../../lib/api.ts";

type Invocation = {
  id: string;
  endpoint_id: string;
  status: string;
  source: string;
  error_class: string | null;
};

export default async function InvocationsPage() {
  const data = await api<{ invocations: Invocation[] }>("/v1/invocations");
  return (
    <>
      <h2>Invocations</h2>
      <h1>Runs</h1>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Source</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {data.invocations.map((invocation) => (
            <tr key={invocation.id}>
              <td>
                <code>{invocation.id}</code>
              </td>
              <td>{invocation.source}</td>
              <td>{invocation.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
