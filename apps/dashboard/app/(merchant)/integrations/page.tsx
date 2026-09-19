import { connectTelegramAction } from "../../../lib/actions.ts";
import { api } from "../../../lib/api.ts";

type Project = { id: string; name: string };
type Endpoint = { id: string; name: string; project_id: string };
type TelegramIntegration = {
  id: string;
  command: string;
  endpoint_id: string;
  token_hint: string;
  webhook_url: string;
};

export default async function IntegrationsPage() {
  const [projects, endpoints, telegram, mcp] = await Promise.all([
    api<{ projects: Project[] }>("/v1/projects"),
    api<{ endpoints: Endpoint[] }>("/v1/endpoints"),
    api<{ integrations: TelegramIntegration[] }>("/v1/integrations/telegram"),
    api<{ servers: { project_id: string; name: string; url: string }[] }>("/v1/integrations/mcp"),
  ]);
  return (
    <>
      <h2>Integrations</h2>
      <h1>Channels</h1>
      <p className="muted">
        Telegram is an adapter. The bot token is stored once and only a hint is shown again. After pay, the same
        invocation resumes — the customer does not retype the command.
      </p>
      <form className="card" action={connectTelegramAction}>
        <h2>Connect Telegram</h2>
        <label>
          Project
          <select name="project_id" required>
            {projects.projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Endpoint
          <select name="endpoint_id" required>
            {endpoints.endpoints.map((endpoint) => (
              <option key={endpoint.id} value={endpoint.id}>
                {endpoint.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Command
          <input name="command" required placeholder="/search" />
        </label>
        <label>
          Input field
          <input name="input_field" placeholder="query" />
        </label>
        <label>
          Bot token
          <input name="bot_token" type="password" autoComplete="off" required placeholder="123456:AAH…" />
        </label>
        <button type="submit">Store token</button>
      </form>
      {telegram.integrations.map((item) => (
        <div className="card" key={item.id}>
          <p>
            <strong>{item.command}</strong> → <code>{item.endpoint_id}</code>
          </p>
          <p className="muted">Token {item.token_hint}</p>
          <p className="muted">{item.webhook_url}</p>
        </div>
      ))}
      <div className="card">
        <h2>MCP</h2>
        <p className="muted">
          The same endpoints are tools. Discovery, payment required, authorization, and execution are separate.
          Silent spend is rejected.
        </p>
        {mcp.servers.map((server) => (
          <p key={server.project_id}>
            {server.name}: <code>{server.url}</code>
          </p>
        ))}
      </div>
      <div className="card">
        <h2>HTTP 402</h2>
        <p className="muted">
          <code>POST /v1/invoke/{"{slug}"}</code> returns Obscurus-native <code>payment_required</code> until a
          payment is authorized. x402 envelopes are later.
        </p>
      </div>
    </>
  );
}
