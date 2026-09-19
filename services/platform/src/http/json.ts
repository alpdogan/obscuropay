import { badRequest } from "@obscurus/core";

export async function readJson<T>(request: Request): Promise<T> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw badRequest("invalid_content_type", "Content-Type must be application/json");
  }
  try {
    return (await request.json()) as T;
  } catch {
    throw badRequest("invalid_json", "Body must be valid JSON");
  }
}
