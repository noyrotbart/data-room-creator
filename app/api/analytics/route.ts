import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getViewsByFile, getViewsByUser, getRecentViews, isOrgAdmin } from "@/lib/db";
import { getOrgFromHeaders } from "@/lib/org";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getServerSession(authOptions);
  const org = await getOrgFromHeaders();
  if (!session?.user?.email || !org) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const admin = await isOrgAdmin(session.user.email, org.id);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [recent, byFile, byUser] = await Promise.all([
    getRecentViews(org.id, 100),
    getViewsByFile(org.id),
    getViewsByUser(org.id),
  ]);

  return NextResponse.json({ recent, byFile, byUser });
}
