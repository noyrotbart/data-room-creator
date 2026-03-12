import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { updateViewDuration } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { filePath?: unknown; durationSeconds?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { filePath, durationSeconds } = body;
  if (typeof filePath !== "string" || typeof durationSeconds !== "number") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (durationSeconds < 1 || durationSeconds > 86400) {
    return NextResponse.json({ error: "Duration out of range" }, { status: 400 });
  }

  try {
    await updateViewDuration(session.user.email, filePath, Math.round(durationSeconds));
  } catch {
    // Non-fatal — don't surface DB errors to the client
  }

  return NextResponse.json({ ok: true });
}
