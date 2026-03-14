import { createOrganization, grantAccess, getOrgBySlug } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESERVED_SLUGS = ["app", "www", "api", "admin", "auth", "signup", "setup", "login", "static", "assets", "mail"];

export async function POST(request: NextRequest) {
  let body: { orgName?: string; slug?: string; adminEmail?: string; adminPassword?: string; adminName?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { orgName, slug, adminEmail, adminPassword, adminName } = body;

  // Validate org name
  if (!orgName || typeof orgName !== "string" || orgName.trim().length < 2) {
    return NextResponse.json({ error: "Organization name must be at least 2 characters" }, { status: 400 });
  }

  // Validate slug
  if (!slug || typeof slug !== "string" || !SLUG_REGEX.test(slug)) {
    return NextResponse.json({ error: "Slug must be 3-50 characters, lowercase alphanumeric and hyphens only" }, { status: 400 });
  }
  if (RESERVED_SLUGS.includes(slug)) {
    return NextResponse.json({ error: "This subdomain is reserved" }, { status: 400 });
  }

  // Check slug availability
  const existing = await getOrgBySlug(slug);
  if (existing) {
    return NextResponse.json({ error: "This subdomain is already taken" }, { status: 409 });
  }

  // Validate admin email
  if (!adminEmail || typeof adminEmail !== "string" || !EMAIL_REGEX.test(adminEmail)) {
    return NextResponse.json({ error: "Valid admin email required" }, { status: 400 });
  }

  // Validate password
  if (!adminPassword || typeof adminPassword !== "string" || adminPassword.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  // Create org
  const org = await createOrganization({
    slug: slug.toLowerCase(),
    name: orgName.trim(),
  });

  // Create admin user
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  await grantAccess({
    email: adminEmail.toLowerCase().trim(),
    name: adminName?.trim() || undefined,
    grantedBy: adminEmail.toLowerCase().trim(),
    orgId: org.id,
    role: "admin",
    passwordHash,
  });

  return NextResponse.json({ ok: true, slug: org.slug, orgUrl: `/setup?org=${slug}` });
}
