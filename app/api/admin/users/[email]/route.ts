import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revokeAccess, grantAccess, getAllowedUsers, setUserPassword, setDownloadPermission, isOrgAdmin } from "@/lib/db";
import { getOrgFromHeaders } from "@/lib/org";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";

async function getOrgAndAdmin() {
  const session = await getServerSession(authOptions);
  const org = await getOrgFromHeaders();
  if (!session?.user?.email || !org) return null;
  const admin = await isOrgAdmin(session.user.email, org.id);
  if (!admin) return null;
  return { session, org };
}

export async function DELETE(_request: NextRequest, { params }: { params: { email: string } }) {
  const ctx = await getOrgAndAdmin();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await revokeAccess(decodeURIComponent(params.email), ctx.org.id);
  return NextResponse.json({ ok: true });
}

export async function PUT(_request: NextRequest, { params }: { params: { email: string } }) {
  const ctx = await getOrgAndAdmin();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const email = decodeURIComponent(params.email);
  const all = await getAllowedUsers(ctx.org.id);
  const existing = all.find((u) => u.email === email);
  await grantAccess({ email, name: existing?.name ?? undefined, grantedBy: ctx.session.user!.email!, orgId: ctx.org.id });
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: NextRequest, { params }: { params: { email: string } }) {
  const ctx = await getOrgAndAdmin();
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const email = decodeURIComponent(params.email);
  let body: { password?: unknown; can_download?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  if ("can_download" in body) {
    await setDownloadPermission(email, ctx.org.id, !!body.can_download);
    return NextResponse.json({ ok: true });
  }
  if (body.password === null || body.password === "") {
    await setUserPassword(email, ctx.org.id, null);
    return NextResponse.json({ ok: true });
  }
  if (typeof body.password !== "string" || body.password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }
  const hash = await bcrypt.hash(body.password, 12);
  await setUserPassword(email, ctx.org.id, hash);
  return NextResponse.json({ ok: true });
}
