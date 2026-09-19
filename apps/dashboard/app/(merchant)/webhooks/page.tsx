import { createWebhookAction, retryWebhookAction } from "../../../lib/actions.ts";
import { api } from "../../../lib/api.ts";

type Webhook = {
  id: string;
  url: string;
  secret_hint: string;
  events: string[];
  last_delivery_status: string | null;
  healthy: boolean;
};

type Delivery = {
  id: string;
  event: string;
  status: string;
  attempt_count: number;
  payload: Record<string, unknown>;
};

export default async function WebhooksPage() {
  const projects = await api<{ projects: { id: string; name: string }[] }>("/v1/projects");
  const data = await api<{ webhooks: Webhook[] }>("/v1/webhooks");
  const deliveries = [];
  for (const hook of data.webhooks) {
    const listed = await api<{ deliveries: Delivery[] }>(`/v1/webhooks/${hook.id}/deliveries`);
    deliveries.push({ hook, items: listed.deliveries });
  }
  return (
    <>
      <h2>Webhooks</h2>
      <h1>Signed callbacks</h1>
      <p className="muted">
        HMAC <code>X-Obscurus-Signature</code> over <code>timestamp.body</code>, plus{" "}
        <code>X-Obscurus-Timestamp</code>. Payloads do not include a customer wallet. The signing secret is shown
        once.
      </p>
      <form className="card" action={createWebhookAction}>
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
          HTTPS URL
          <input name="url" required placeholder="https://merchant.example/hooks" />
        </label>
        <button type="submit">Create webhook</button>
      </form>
      {deliveries.map(({ hook, items }) => (
        <div className="card" key={hook.id}>
          <p>
            <code>{hook.url}</code> — {hook.healthy ? "healthy" : hook.last_delivery_status}
          </p>
          <p className="muted">Secret {hook.secret_hint}</p>
          {items.map((delivery) => (
            <form action={retryWebhookAction} key={delivery.id}>
              <p>
                {delivery.event} · {delivery.status} · attempt {delivery.attempt_count}
              </p>
              <p className="muted">{JSON.stringify(delivery.payload)}</p>
              <input type="hidden" name="delivery_id" value={delivery.id} />
              <button className="secondary" type="submit">
                Retry
              </button>
            </form>
          ))}
        </div>
      ))}
    </>
  );
}
