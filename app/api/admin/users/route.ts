import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAllowedUsersWithActivity, grantAccess, isOrgAdmin } from "@/lib/db";
import { getOrgFromHeaders } from "@/lib/org";
import { sendInviteEmail } from "@/lib/email";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET() {
  const session = await getServerSession(authOptions);
  const org = await getOrgFromHeaders();
  if (!session?.user?.email || !org) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const admin = await isOrgAdmin(session.user.email, org.id);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const users = await getAllowedUsersWithActivity(org.id);
  return NextResponse.json(users);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const org = await getOrgFromHeaders();
  if (!session?.user?.email || !org) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const admin = await isOrgAdmin(session.user.email, org.id);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { email?: unknown; name?: unknown; durationDays?: unknown; password?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { email, name, durationDays, password } = body;
  if (typeof email !== "string" || !EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: "Valid email required (e.g., user@example.com)" }, { status: 400 });
  }
  if (password !== undefined && password !== null && password !== "") {
    if (typeof password !== "string" || password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }
  }

  const cleanEmail = email.toLowerCase().trim();
  const cleanName = typeof name === "string" ? name.trim() || undefined : undefined;
  const cleanDays = typeof durationDays === "number" && durationDays > 0 ? Math.round(durationDays) : 7;
  const hasPassword = typeof password === "string" && password.length >= 8;
  const passwordHash = hasPassword ? await bcrypt.hash(password as string, 10) : null;

  await grantAccess({
    email: cleanEmail, name: cleanName, grantedBy: session.user!.email!, durationDays: cleanDays,
    passwordHash, orgId: org.id,
  });

  const platformDomain = process.env.PLATFORM_DOMAIN;
  const protocol = platformDomain?.includes("localhost") ? "http" : "https";
  const appUrl = platformDomain ? `${protocol}://${org.slug}.${platformDomain}` : process.env.NEXTAUTH_URL;

  const emailResult = await sendInviteEmail({
    toEmail: cleanEmail, toName: cleanName, invitedBy: session.user!.email!, hasPassword,
    orgName: org.name, appUrl,
  });

  return NextResponse.json({ ok: true, emailSent: emailResult.ok, emailError: emailResult.error ?? null });
}
