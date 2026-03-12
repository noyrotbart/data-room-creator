import { getServerSession } from "next-auth";
import { authOptions, isAdmin } from "@/lib/auth";
import { getAllowedUsersWithActivity, grantAccess } from "@/lib/db";
import { sendInviteEmail } from "@/lib/email";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !isAdmin(session.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await getAllowedUsersWithActivity();
  return NextResponse.json(users);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !isAdmin(session.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { email?: unknown; name?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { email, name } = body;
  if (typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const cleanEmail = email.toLowerCase().trim();
  const cleanName = typeof name === "string" ? name.trim() || undefined : undefined;

  await grantAccess({ email: cleanEmail, name: cleanName, grantedBy: session.user!.email! });

  const emailResult = await sendInviteEmail({ toEmail: cleanEmail, toName: cleanName, invitedBy: session.user!.email! });

  return NextResponse.json({ ok: true, emailSent: emailResult.ok, emailError: emailResult.error ?? null });
}
