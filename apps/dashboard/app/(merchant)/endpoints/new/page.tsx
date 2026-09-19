import { createProjectAction, importCurlAction } from "../../../../lib/actions.ts";
import { api } from "../../../../lib/api.ts";

export default async function NewEndpointPage() {
  const projects = await api<{ projects: { id: string; name: string }[] }>("/v1/projects");
  return (
    <>
      <h2>cURL wizard</h2>
      <h1>Paste an existing request</h1>
      <p className="muted">
        The importer is a parser, not a shell. Secrets are stored once and only a hint is shown again.
      </p>
      {projects.projects.length === 0 ? (
        <form className="card" action={createProjectAction}>
          <label>
            First project name
            <input name="name" required placeholder="Acme Search" />
          </label>
          <button type="submit">Create project</button>
        </form>
      ) : (
        <form className="card" action={importCurlAction}>
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
            Name
            <input name="name" required defaultValue="Imported endpoint" />
          </label>
          <label>
            Price (USDC)
            <input name="price_amount" required defaultValue="0.50" />
          </label>
          <label>
            Customer fields (comma-separated)
            <input name="customer_fields" placeholder="query" />
          </label>
          <label>
            cURL
            <textarea name="curl" required rows={8} placeholder='curl https://api.example.com/search -H "Authorization: Bearer …"' />
          </label>
          <button type="submit">Create endpoint</button>
        </form>
      )}
    </>
  );
}
