import { getServerSession } from "next-auth";
import { authOptions, isAdmin } from "@/lib/auth";
import { revokeAccess, grantAccess, getAllowedUsers, setUserPassword } from "@/lib/db";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { email: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || !isAdmin(session.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const email = decodeURIComponent(params.email);
  await revokeAccess(email);
  return NextResponse.json({ ok: true });
}

export async function PUT(
  _request: NextRequest,
  { params }: { params: { email: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || !isAdmin(session.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const email = decodeURIComponent(params.email);
  // Find the existing user's name to preserve it on re-grant
  const all = await getAllowedUsers();
  const existing = all.find((u) => u.email === email);
  await grantAccess({
    email,
    name: existing?.name ?? undefined,
    grantedBy: session.user!.email!,
  });
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { email: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || !isAdmin(session.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const email = decodeURIComponent(params.email);
  let body: { password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.password === null || body.password === "") {
    // Clear password — user must use Google
    await setUserPassword(email, null);
    return NextResponse.json({ ok: true });
  }

  if (typeof body.password !== "string" || body.password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const hash = await bcrypt.hash(body.password, 12);
  await setUserPassword(email, hash);
  return NextResponse.json({ ok: true });
}
