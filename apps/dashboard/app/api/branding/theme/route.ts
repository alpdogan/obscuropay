import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { platformOrigin } from "../../../../lib/config.ts";

export async function PATCH(request: Request) {
  const jar = await cookies();
  const session = jar.get("obscurus_session")?.value;

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();

    const response = await fetch(`${platformOrigin()}/v1/branding/theme`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: `obscurus_session=${session}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update theme" },
      { status: 500 },
    );
  }
}

export async function GET() {
  const jar = await cookies();
  const session = jar.get("obscurus_session")?.value;

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const response = await fetch(`${platformOrigin()}/v1/branding/theme`, {
      headers: {
        Cookie: `obscurus_session=${session}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch theme" },
      { status: 500 },
    );
  }
}
