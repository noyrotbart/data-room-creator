import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrgFromHeaders } from "@/lib/org";
import { isOrgAdmin, updateOrgSettings } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const org = await getOrgFromHeaders();
  if (!org) {
    return NextResponse.json({ error: "Org not found" }, { status: 404 });
  }

  const admin = await isOrgAdmin(session.user.email, org.id);
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { name?: string; logoUrl?: string; primaryColor?: string; driveFolderId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  await updateOrgSettings(org.id, body);
  return NextResponse.json({ ok: true });
}

export async function GET() {
  const org = await getOrgFromHeaders();
  if (!org) {
    return NextResponse.json({ error: "Org not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: org.id,
    slug: org.slug,
    name: org.name,
    logoUrl: org.logo_url,
    primaryColor: org.primary_color,
    driveFolderId: org.drive_folder_id,
  });
}
