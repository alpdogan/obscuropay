import { redirect } from "next/navigation";
import { hasSession } from "../lib/api.ts";

export default async function HomePage() {
  redirect((await hasSession()) ? "/overview" : "/login");
}
